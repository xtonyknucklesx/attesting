import type Database from 'better-sqlite3';
import type { PropagationContext } from './types.js';
import { logEntry } from './types.js';
import { createDriftAlert } from '../drift/alert-writer.js';

/**
 * Handles a policy content change: walks downstream to find all
 * policy_sections, then all implementations referencing those sections,
 * and creates drift alerts for stale authority.
 */
export function onPolicyContentChange(
  db: Database.Database,
  ctx: PropagationContext,
  policyId: string,
): void {
  const policy = db.prepare(
    'SELECT id, title, short_name, content_hash, next_review_date FROM policies WHERE id = ?'
  ).get(policyId) as any;
  if (!policy) return;

  // Check review overdue
  if (policy.next_review_date && new Date(policy.next_review_date) < new Date()) {
    if (!ctx.dryRun) {
      createDriftAlert(db, {
        alert_type: 'review_overdue',
        severity: 'medium',
        title: `Policy review overdue: ${policy.title}`,
        message: `Review was due on ${policy.next_review_date}`,
        source_entity_type: 'policy',
        source_entity_id: policyId,
      });
    }
    logEntry(ctx, 'review_overdue', { policy_id: policyId });
  }

  // Walk all sections for this policy
  const sections = db.prepare(
    'SELECT id, section_number FROM policy_sections WHERE policy_id = ?'
  ).all(policyId) as Array<{ id: string; section_number: string }>;

  for (const section of sections) {
    onPolicySectionChange(db, ctx, section.id);
  }
}

/**
 * Handles a single policy section change: finds implementations
 * that reference this section and flags them as stale.
 */
export function onPolicySectionChange(
  db: Database.Database,
  ctx: PropagationContext,
  sectionId: string,
): void {
  const section = db.prepare(`
    SELECT ps.*, p.short_name, p.title AS policy_title
    FROM policy_sections ps
    JOIN policies p ON ps.policy_id = p.id
    WHERE ps.id = ?
  `).get(sectionId) as any;
  if (!section) return;

  // Find implementations referencing this section via policy_controls
  // (policy_controls links policies to controls, implementations link to controls)
  const impacted = db.prepare(`
    SELECT i.id, i.primary_control_id, c.control_id AS control_ref
    FROM implementations i
    JOIN controls c ON i.primary_control_id = c.id
    JOIN policy_controls pc ON pc.control_id = c.id AND pc.policy_id = ?
  `).all(section.policy_id) as Array<{ id: string; control_ref: string }>;

  for (const impl of impacted) {
    logEntry(ctx, 'control_stale', {
      implementation_id: impl.id,
      control_id: impl.control_ref,
      reason: `Policy section ${section.section_number} updated`,
      policy: section.short_name ?? section.policy_title,
    });

    if (!ctx.dryRun) {
      createDriftAlert(db, {
        alert_type: 'policy_stale',
        severity: 'high',
        title: `Control references updated policy: ${section.short_name ?? ''} §${section.section_number}`,
        message: `Implementation for ${impl.control_ref} may need review after policy change.`,
        source_entity_type: 'policy_section',
        source_entity_id: sectionId,
        affected_entities: JSON.stringify([
          { type: 'implementation', id: impl.id, name: impl.control_ref },
        ]),
      });
    }
  }
}

/**
 * Handles a policy being retired — all linked implementations lose authority.
 */
export function onPolicyRetired(
  db: Database.Database,
  ctx: PropagationContext,
  policyId: string,
): void {
  const impacted = db.prepare(`
    SELECT i.id, c.control_id AS control_ref
    FROM implementations i
    JOIN controls c ON i.primary_control_id = c.id
    JOIN policy_controls pc ON pc.control_id = c.id AND pc.policy_id = ?
  `).all(policyId) as Array<{ id: string; control_ref: string }>;

  for (const impl of impacted) {
    logEntry(ctx, 'authority_lost', {
      implementation_id: impl.id,
      control_id: impl.control_ref,
    });

    if (!ctx.dryRun) {
      createDriftAlert(db, {
        alert_type: 'policy_stale',
        severity: 'critical',
        title: `Control has no active policy authority: ${impl.control_ref}`,
        message: `The governing policy has been retired.`,
        source_entity_type: 'implementation',
        source_entity_id: impl.id,
      });
    }
  }
}
