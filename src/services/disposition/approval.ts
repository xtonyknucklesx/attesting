import type Database from 'better-sqlite3';
import type { DispositionType } from '../../models/disposition.js';
import { REQUIRES_SUPERVISOR, DISPOSITION_TTL_DAYS } from '../../models/disposition.js';
import { generateUuid } from '../../utils/uuid.js';
import { propagate } from '../propagation/dispatcher.js';
import { classifyDisposition } from './classifier.js';
import { extractEntities, extractTemporalRef } from './entity-extractor.js';
import { identifyAutoTasks, createDispositionTasks } from './task-generator.js';

export interface ProcessedDisposition {
  drift_alert_id: string;
  disposition_type: DispositionType;
  analyst_id: string;
  rationale: string;
  rationale_parsed: string;
  linked_entities: string;
  compensating_impl_id: string | null;
  deferral_target_date: string | null;
  requires_approval: boolean;
  approval_status: string;
  supervisor_id: string | null;
  expires_at: string;
  nlp_confidence: number;
  auto_tasks: any[];
}

/**
 * Processes analyst natural language into a structured disposition.
 * Does not commit — returns the disposition for confirmation.
 */
export function processDispositionInput(
  db: Database.Database,
  driftAlertId: string,
  analystId: string,
  text: string,
): { disposition: ProcessedDisposition; needs_confirmation: boolean; response: string } {
  const classification = classifyDisposition(text);
  const entities = extractEntities(text);
  const temporal = extractTemporalRef(text);
  const requiresApproval = REQUIRES_SUPERVISOR.has(classification.type);
  const autoTasks = identifyAutoTasks(db, text, classification.type, entities, driftAlertId);
  const supervisor = requiresApproval ? findSupervisor(db, analystId) : null;

  const disposition: ProcessedDisposition = {
    drift_alert_id: driftAlertId,
    disposition_type: classification.type,
    analyst_id: analystId,
    rationale: text,
    rationale_parsed: JSON.stringify({ classification, entities, temporal }),
    linked_entities: JSON.stringify(entities),
    compensating_impl_id: findCompensatingImpl(db, text),
    deferral_target_date: temporal?.resolved_date ?? null,
    requires_approval: requiresApproval,
    approval_status: requiresApproval ? 'pending' : 'approved',
    supervisor_id: supervisor?.id ?? null,
    expires_at: calculateExpiry(classification.type, temporal),
    nlp_confidence: classification.confidence,
    auto_tasks: autoTasks,
  };

  return {
    disposition,
    needs_confirmation: classification.confidence < 0.7,
    response: buildResponse(disposition, autoTasks, supervisor),
  };
}

/**
 * Commits a processed disposition to the database
 * and triggers propagation if self-approved.
 */
export function commitDisposition(
  db: Database.Database,
  data: ProcessedDisposition,
): { disposition_id: string; task_ids: string[] } {
  const id = generateUuid();

  db.prepare(`
    INSERT INTO dispositions (
      id, drift_alert_id, disposition_type, analyst_id, rationale,
      rationale_parsed, linked_entities, compensating_impl_id,
      deferral_target_date, requires_approval, approval_status,
      supervisor_id, expires_at, nlp_confidence
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.drift_alert_id, data.disposition_type, data.analyst_id,
    data.rationale, data.rationale_parsed, data.linked_entities,
    data.compensating_impl_id, data.deferral_target_date,
    data.requires_approval ? 1 : 0, data.approval_status,
    data.supervisor_id, data.expires_at, data.nlp_confidence,
  );

  const taskIds = createDispositionTasks(db, id, data.auto_tasks);
  if (taskIds.length > 0) {
    db.prepare('UPDATE dispositions SET auto_tasks_created = ? WHERE id = ?')
      .run(JSON.stringify(taskIds), id);
  }

  // If self-approved, trigger propagation immediately
  if (data.approval_status === 'approved') {
    propagate(db, 'disposition', id, 'approve',
      { type: 'user', id: data.analyst_id }, null, data);
  }

  return { disposition_id: id, task_ids: taskIds };
}

/**
 * Supervisor approves a pending disposition.
 */
export function approveDisposition(
  db: Database.Database,
  dispositionId: string,
  supervisorId: string,
  note?: string,
): void {
  const disp = db.prepare('SELECT * FROM dispositions WHERE id = ?').get(dispositionId) as any;
  if (!disp) throw new Error('Disposition not found');
  if (disp.approval_status !== 'pending') throw new Error(`Cannot approve: ${disp.approval_status}`);

  const supervisor = db.prepare('SELECT is_supervisor FROM owners WHERE id = ?').get(supervisorId) as any;
  if (!supervisor?.is_supervisor) throw new Error('Not authorized to approve');

  db.prepare(`
    UPDATE dispositions
    SET approval_status = 'approved', supervisor_id = ?,
        supervisor_note = ?, approved_at = datetime('now'),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(supervisorId, note ?? null, dispositionId);

  propagate(db, 'disposition', dispositionId, 'approve',
    { type: 'user', id: supervisorId }, disp, { ...disp, approval_status: 'approved' });
}

/**
 * Supervisor rejects a pending disposition.
 */
export function rejectDisposition(
  db: Database.Database,
  dispositionId: string,
  supervisorId: string,
  note: string,
): void {
  db.prepare(`
    UPDATE dispositions
    SET approval_status = 'rejected', supervisor_id = ?,
        supervisor_note = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(supervisorId, note, dispositionId);
}

// ── Helpers ──────────────────────────────────────────────────

function findSupervisor(
  db: Database.Database,
  analystId: string,
): { id: string; name: string } | null {
  return db.prepare(`
    SELECT id, name FROM owners
    WHERE is_supervisor = 1 AND id != ?
    ORDER BY name LIMIT 1
  `).get(analystId) as { id: string; name: string } | null;
}

function findCompensatingImpl(db: Database.Database, text: string): string | null {
  const m = text.match(/(?:control\s+)?([A-Z]{2}-\d{1,2}(?:\(\d+\))?)/);
  if (!m) return null;
  const impl = db.prepare(`
    SELECT i.id FROM implementations i
    JOIN controls c ON i.primary_control_id = c.id
    WHERE c.control_id = ? LIMIT 1
  `).get(m[1]) as { id: string } | undefined;
  return impl?.id ?? null;
}

function calculateExpiry(type: DispositionType, temporal: any): string {
  if (temporal?.resolved_date) {
    const d = new Date(temporal.resolved_date);
    d.setDate(d.getDate() + 7);
    return d.toISOString();
  }
  const days = DISPOSITION_TTL_DAYS[type] ?? 180;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function buildResponse(
  disp: ProcessedDisposition,
  tasks: any[],
  supervisor: { name: string } | null,
): string {
  const parts = [`Classified as **${disp.disposition_type.replace(/_/g, ' ')}**.`];
  const effects: string[] = [];
  if (disp.deferral_target_date) effects.push(`remediation target: ${disp.deferral_target_date}`);
  if (tasks.length > 0) effects.push(`${tasks.length} follow-up task(s) created`);
  if (effects.length > 0) parts.push(`This will ${effects.join(', ')}.`);
  if (disp.requires_approval && supervisor) parts.push(`Requires approval — routing to ${supervisor.name}.`);
  return parts.join(' ');
}
