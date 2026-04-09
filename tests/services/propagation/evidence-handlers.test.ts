import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedOrg, seedCatalog, seedImplementation } from '../../helpers/test-db.js';
import { onEvidenceChange } from '../../../src/services/propagation/evidence-handlers.js';
import { createContext } from '../../../src/services/propagation/types.js';
import { generateUuid } from '../../../src/utils/uuid.js';
import type Database from 'better-sqlite3';

describe('onEvidenceChange', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('runs without crashing on seeded evidence data', () => {
    const { orgId } = seedOrg(db);
    const { controlIds } = seedCatalog(db, 1);
    const implId = seedImplementation(db, orgId, controlIds[0], 'implemented');

    // Seed an evidence record linked to the implementation
    const evidenceId = generateUuid();
    db.prepare(`
      INSERT INTO evidence (id, implementation_id, title, evidence_type, collected_at, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(evidenceId, implId, 'Test Evidence', 'document', new Date().toISOString());

    const ctx = createContext({ type: 'user' as const, id: 'test' });
    const prev = { evidence_type: 'document' };
    const next = { evidence_type: 'expired' };

    // Should not throw
    onEvidenceChange(db, ctx, evidenceId, prev, next);

    // Should log the expiry
    expect(ctx.log.some(e => e.type === 'evidence_expired')).toBe(true);
  });

  it('is a no-op when evidence is not expired', () => {
    const { orgId } = seedOrg(db);
    const { controlIds } = seedCatalog(db, 1);
    const implId = seedImplementation(db, orgId, controlIds[0], 'implemented');

    const evidenceId = generateUuid();
    db.prepare(`
      INSERT INTO evidence (id, implementation_id, title, evidence_type, collected_at, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(evidenceId, implId, 'Fresh Evidence', 'document', new Date().toISOString());

    const ctx = createContext({ type: 'user' as const, id: 'test' });
    const prev = { evidence_type: 'document' };
    const next = { evidence_type: 'document', collected_at: new Date().toISOString() };

    onEvidenceChange(db, ctx, evidenceId, prev, next);

    // Not expired, so no log entries
    expect(ctx.log.length).toBe(0);
  });

  it('does not crash when evidence ID does not exist', () => {
    const ctx = createContext({ type: 'user' as const, id: 'test' });
    onEvidenceChange(db, ctx, 'nonexistent-id', {}, { evidence_type: 'expired' });
    // Should return early without error
    expect(ctx.log).toEqual([]);
  });
});
