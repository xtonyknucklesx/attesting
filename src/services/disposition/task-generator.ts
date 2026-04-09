import type Database from 'better-sqlite3';
import type { DispositionType } from '../../models/disposition.js';
import type { ExtractedEntity } from './entity-extractor.js';
import { generateUuid } from '../../utils/uuid.js';

export interface TaskTemplate {
  title: string;
  description: string;
  target_entity_type?: string;
  target_entity_id?: string;
}

/**
 * Analyzes a disposition's rationale + entities and generates
 * follow-up tasks that should be auto-created.
 */
export function identifyAutoTasks(
  db: Database.Database,
  text: string,
  dispositionType: DispositionType,
  entities: ExtractedEntity[],
  driftAlertId: string,
): TaskTemplate[] {
  const tasks: TaskTemplate[] = [];

  // "hasn't been updated yet" → create policy update task
  if (/hasn(?:'t|ot)\s+been\s+(?:updated|changed|revised)/i.test(text)) {
    const policyRefs = entities.filter(e =>
      e.type === 'policy_section' || e.type === 'nispom_section'
    );
    for (const ref of policyRefs) {
      tasks.push({
        title: `Update policy section ${ref.value}`,
        description: 'Policy section referenced in disposition needs updating to reflect current practice.',
        target_entity_type: 'policy_section',
        target_entity_id: ref.value,
      });
    }
  }

  // Compensating control → documentation task
  if (dispositionType === 'compensating_control') {
    tasks.push({
      title: 'Document compensating control justification',
      description: 'Formally document why the compensating control provides equivalent protection.',
      target_entity_type: 'implementation',
    });
  }

  // Deferred → remediation task
  if (dispositionType === 'deferred') {
    const alert = db.prepare('SELECT title FROM drift_alerts WHERE id = ?').get(driftAlertId) as
      { title: string } | undefined;
    tasks.push({
      title: `Remediate: ${alert?.title ?? 'deferred item'}`,
      description: 'Deferred remediation from drift alert disposition.',
      target_entity_type: 'drift_alert',
      target_entity_id: driftAlertId,
    });
  }

  // MCAT item referenced → re-assessment task
  for (const ref of entities.filter(e => e.type === 'mcat_item')) {
    tasks.push({
      title: `Re-assess MCAT item ${ref.value}`,
      description: 'MCAT item referenced in disposition — flag for re-assessment when underlying issue is resolved.',
      target_entity_type: 'mcat_item',
      target_entity_id: ref.value,
    });
  }

  return tasks;
}

/**
 * Persists auto-generated tasks to the disposition_tasks table.
 * Returns the created task IDs.
 */
export function createDispositionTasks(
  db: Database.Database,
  dispositionId: string,
  tasks: TaskTemplate[],
): string[] {
  const insert = db.prepare(`
    INSERT INTO disposition_tasks (id, disposition_id, title, description,
                                   target_entity_type, target_entity_id, status)
    VALUES (?, ?, ?, ?, ?, ?, 'open')
  `);

  const ids: string[] = [];
  for (const task of tasks) {
    const id = generateUuid();
    insert.run(id, dispositionId, task.title, task.description,
               task.target_entity_type ?? null, task.target_entity_id ?? null);
    ids.push(id);
  }
  return ids;
}
