/**
 * Tests for the disposition approval pipeline — processes analyst text
 * into structured dispositions and commits them to the database.
 *
 * Uses an in-memory SQLite database with seeded drift alerts and owners.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, seedDriftAlert, seedOwner } from '../../helpers/test-db.js';
import { processDispositionInput, commitDisposition } from '../../../src/services/disposition/approval.js';
import type Database from 'better-sqlite3';

// Mock the propagation dispatcher to avoid side effects during tests
vi.mock('../../../src/services/propagation/dispatcher.js', () => ({
  propagate: vi.fn(),
}));

describe('processDispositionInput', () => {
  let db: Database.Database;
  let alertId: string;
  let analystId: string;
  let supervisorId: string;

  beforeEach(() => {
    db = createTestDb();
    alertId = seedDriftAlert(db, { severity: 'high' });
    analystId = seedOwner(db, { name: 'Test Analyst', supervisor: false });
    supervisorId = seedOwner(db, { name: 'Test Supervisor', supervisor: true });
  });

  it('routes accepted_risk to supervisor approval', () => {
    const result = processDispositionInput(db, alertId, analystId, 'We have accepted the risk');

    expect(result.disposition.disposition_type).toBe('accepted_risk');
    expect(result.disposition.requires_approval).toBe(true);
    expect(result.disposition.approval_status).toBe('pending');
    expect(result.disposition.supervisor_id).toBe(supervisorId);
  });

  it('self-approves false_positive dispositions', () => {
    const result = processDispositionInput(db, alertId, analystId, 'This is a false positive');

    expect(result.disposition.disposition_type).toBe('false_positive');
    expect(result.disposition.requires_approval).toBe(false);
    expect(result.disposition.approval_status).toBe('approved');
    expect(result.disposition.supervisor_id).toBeNull();
  });

  it('self-approves deferred dispositions', () => {
    const result = processDispositionInput(db, alertId, analystId, 'Deferring to next quarter');

    expect(result.disposition.disposition_type).toBe('deferred');
    expect(result.disposition.requires_approval).toBe(false);
    expect(result.disposition.approval_status).toBe('approved');
  });

  it('assigns expires_at on every disposition', () => {
    const types = [
      'We have accepted the risk',
      'This is a false positive',
      'Deferring to next quarter',
      'Not applicable to our environment',
    ];

    for (const text of types) {
      const result = processDispositionInput(db, alertId, analystId, text);
      expect(result.disposition.expires_at).toBeTruthy();
      // expires_at should be a parseable date string
      expect(new Date(result.disposition.expires_at).getTime()).not.toBeNaN();
    }
  });

  it('returns a non-empty response string', () => {
    const result = processDispositionInput(db, alertId, analystId, 'We have accepted the risk');
    expect(result.response).toBeTruthy();
    expect(result.response.length).toBeGreaterThan(0);
  });

  it('includes classification confidence in the disposition', () => {
    const result = processDispositionInput(db, alertId, analystId, 'This is a false positive');
    expect(result.disposition.nlp_confidence).toBeGreaterThan(0);
    expect(result.disposition.nlp_confidence).toBeLessThanOrEqual(1);
  });

  it('routes by_design to supervisor approval', () => {
    const result = processDispositionInput(
      db, alertId, analystId,
      'This is by design, we configured it that way',
    );
    expect(result.disposition.requires_approval).toBe(true);
    expect(result.disposition.approval_status).toBe('pending');
  });

  it('routes compensating_control to supervisor approval', () => {
    const result = processDispositionInput(
      db, alertId, analystId,
      'Covered by a compensating control AC-4',
    );
    expect(result.disposition.requires_approval).toBe(true);
    expect(result.disposition.approval_status).toBe('pending');
  });

  it('routes not_applicable to supervisor approval', () => {
    const result = processDispositionInput(
      db, alertId, analystId,
      'Not applicable to our environment',
    );
    expect(result.disposition.requires_approval).toBe(true);
    expect(result.disposition.approval_status).toBe('pending');
  });

  it('sets deferral_target_date when temporal ref is present', () => {
    const result = processDispositionInput(db, alertId, analystId, 'Deferring to Q2');
    expect(result.disposition.deferral_target_date).toBeTruthy();
    expect(result.disposition.deferral_target_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('commitDisposition', () => {
  let db: Database.Database;
  let alertId: string;
  let analystId: string;

  beforeEach(() => {
    db = createTestDb();
    alertId = seedDriftAlert(db, { severity: 'medium' });
    analystId = seedOwner(db, { name: 'Committer', supervisor: false });
    // Seed a supervisor so processDispositionInput can find one if needed
    seedOwner(db, { name: 'Supervisor', supervisor: true });
  });

  it('inserts a disposition row and returns an ID', () => {
    const { disposition } = processDispositionInput(
      db, alertId, analystId, 'This is a false positive',
    );
    const result = commitDisposition(db, disposition);

    expect(result.disposition_id).toBeTruthy();

    // Verify the row exists in the database
    const row = db.prepare('SELECT * FROM dispositions WHERE id = ?').get(result.disposition_id) as any;
    expect(row).toBeDefined();
    expect(row.disposition_type).toBe('false_positive');
    expect(row.approval_status).toBe('approved');
  });

  it('creates auto-tasks and returns their IDs', () => {
    const { disposition } = processDispositionInput(
      db, alertId, analystId, 'Deferring to next quarter',
    );
    const result = commitDisposition(db, disposition);

    // Deferred dispositions always generate at least a remediation task
    expect(result.task_ids.length).toBeGreaterThanOrEqual(1);

    // Verify tasks exist in the database
    for (const taskId of result.task_ids) {
      const task = db.prepare('SELECT * FROM disposition_tasks WHERE id = ?').get(taskId) as any;
      expect(task).toBeDefined();
      expect(task.status).toBe('open');
    }
  });

  it('stores auto_tasks_created JSON on the disposition row', () => {
    const { disposition } = processDispositionInput(
      db, alertId, analystId, 'Deferring to next quarter',
    );
    const result = commitDisposition(db, disposition);

    if (result.task_ids.length > 0) {
      const row = db.prepare('SELECT auto_tasks_created FROM dispositions WHERE id = ?')
        .get(result.disposition_id) as any;
      const stored = JSON.parse(row.auto_tasks_created);
      expect(stored).toEqual(result.task_ids);
    }
  });
});
