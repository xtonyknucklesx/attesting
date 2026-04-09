/**
 * Tests for disposition task generator — identifies follow-up tasks
 * that should be auto-created based on disposition text and type.
 *
 * Uses an in-memory SQLite database for drift alert lookups.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedDriftAlert, seedOwner } from '../../helpers/test-db.js';
import { identifyAutoTasks, createDispositionTasks } from '../../../src/services/disposition/task-generator.js';
import type Database from 'better-sqlite3';
import type { ExtractedEntity } from '../../../src/services/disposition/entity-extractor.js';

describe('identifyAutoTasks', () => {
  let db: Database.Database;
  let alertId: string;

  beforeEach(() => {
    db = createTestDb();
    alertId = seedDriftAlert(db, { alertType: 'evidence_expired', severity: 'medium' });
  });

  it('generates a remediation task for deferred dispositions', () => {
    const tasks = identifyAutoTasks(db, 'Deferring to next quarter', 'deferred', [], alertId);
    expect(tasks.length).toBeGreaterThanOrEqual(1);

    const remediation = tasks.find(t => t.target_entity_type === 'drift_alert');
    expect(remediation).toBeDefined();
    expect(remediation!.title).toContain('Remediate');
    expect(remediation!.target_entity_id).toBe(alertId);
  });

  it('generates a documentation task for compensating_control dispositions', () => {
    const tasks = identifyAutoTasks(db, 'Covered by compensating control', 'compensating_control', [], alertId);
    expect(tasks.length).toBeGreaterThanOrEqual(1);

    const doc = tasks.find(t => t.title.includes('Document compensating control'));
    expect(doc).toBeDefined();
    expect(doc!.target_entity_type).toBe('implementation');
  });

  it('generates policy update task when text mentions outdated policy', () => {
    const entities: ExtractedEntity[] = [
      { type: 'policy_section', value: '3.1', full_match: 'section 3.1', position: 10 },
    ];
    const text = "Policy section 3.1 hasn't been updated yet";
    const tasks = identifyAutoTasks(db, text, 'accepted_risk', entities, alertId);

    const policyTask = tasks.find(t => t.title.includes('Update policy section'));
    expect(policyTask).toBeDefined();
    expect(policyTask!.target_entity_id).toBe('3.1');
  });

  it('generates MCAT re-assessment task when MCAT items are referenced', () => {
    const entities: ExtractedEntity[] = [
      { type: 'mcat_item', value: '4.002', full_match: 'MCAT item 4.002', position: 0 },
    ];
    const tasks = identifyAutoTasks(db, 'See MCAT item 4.002', 'deferred', entities, alertId);

    const mcatTask = tasks.find(t => t.title.includes('Re-assess MCAT item'));
    expect(mcatTask).toBeDefined();
    expect(mcatTask!.target_entity_id).toBe('4.002');
  });

  it('returns empty array when no actionable phrases match', () => {
    const tasks = identifyAutoTasks(db, 'This is a false positive', 'false_positive', [], alertId);
    expect(tasks).toEqual([]);
  });
});

describe('createDispositionTasks', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();

    // Seed owner + disposition to satisfy foreign keys
    const alertId = seedDriftAlert(db);
    const ownerId = seedOwner(db);
    db.prepare(`
      INSERT INTO dispositions (id, drift_alert_id, disposition_type, analyst_id,
        rationale, requires_approval, approval_status, nlp_confidence)
      VALUES ('disp-1', ?, 'deferred', ?, 'test', 0, 'approved', 0.9)
    `).run(alertId, ownerId);
  });

  it('persists tasks to the database and returns IDs', () => {
    const templates = [
      { title: 'Task A', description: 'Do thing A' },
      { title: 'Task B', description: 'Do thing B', target_entity_type: 'drift_alert', target_entity_id: 'alert-1' },
    ];

    const ids = createDispositionTasks(db, 'disp-1', templates);
    expect(ids.length).toBe(2);

    // Verify rows exist in the database
    const rows = db.prepare('SELECT * FROM disposition_tasks WHERE disposition_id = ?').all('disp-1') as any[];
    expect(rows.length).toBe(2);
    expect(rows.every((r: any) => r.status === 'open')).toBe(true);
  });
});
