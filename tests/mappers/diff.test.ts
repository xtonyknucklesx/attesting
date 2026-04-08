/**
 * Tests for the catalog diff engine.
 *
 * Uses two small fixture catalogs (5 controls each) with known
 * additions, removals, modifications, and renumberings.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import { generateUuid } from '../../src/utils/uuid.js';
import { diffCatalogs, wordDiff, textSimilarity } from '../../src/mappers/diff.js';

const SCHEMA_PATH = path.join(__dirname, '../../src/db/schema.sql');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);
  return db;
}

const t = () => new Date().toISOString();

interface CatalogFixture {
  catalogId: string;
  shortName: string;
  controls: Array<{ id: string; controlId: string; title: string; description: string }>;
}

function createCatalog(db: Database.Database, shortName: string, name: string): string {
  const catalogId = generateUuid();
  db.prepare(
    `INSERT INTO catalogs (id, name, short_name, source_format, created_at, updated_at)
     VALUES (?, ?, ?, 'csv', ?, ?)`
  ).run(catalogId, name, shortName, t(), t());
  return catalogId;
}

function insertControl(
  db: Database.Database,
  catalogId: string,
  controlId: string,
  title: string,
  description: string,
  sortOrder: number
): string {
  const id = generateUuid();
  db.prepare(
    `INSERT INTO controls (id, catalog_id, control_id, title, description, metadata, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, '{}', ?, ?)`
  ).run(id, catalogId, controlId, title, description, sortOrder, t());
  return id;
}

/**
 * Seed two fixture catalogs for diff testing.
 *
 * OLD catalog (fw-v1):
 *   AC-1: Access Control Policy        — unchanged in new
 *   AC-2: Account Management           — modified in new (description changes)
 *   AC-3: Access Enforcement           — removed in new
 *   AC-4: Information Flow             — renumbered to AC-40 in new
 *   AC-5: Separation of Duties         — unchanged in new
 *
 * NEW catalog (fw-v2):
 *   AC-1: Access Control Policy        — same
 *   AC-2: Account Management           — modified description
 *   AC-5: Separation of Duties         — same
 *   AC-40: Information Flow             — renumbered from AC-4 (same description)
 *   AC-6: Least Privilege              — new control
 */
function seedFixtureCatalogs(db: Database.Database): {
  oldCatalogId: string;
  newCatalogId: string;
  orgId: string;
  controls: Record<string, string>;
} {
  const oldCatalogId = createCatalog(db, 'fw-v1', 'Framework v1');
  const newCatalogId = createCatalog(db, 'fw-v2', 'Framework v2');

  const controls: Record<string, string> = {};

  // OLD controls
  controls['old-ac1'] = insertControl(db, oldCatalogId, 'AC-1',
    'Access Control Policy',
    'The organization develops, documents, and disseminates an access control policy.',
    1);
  controls['old-ac2'] = insertControl(db, oldCatalogId, 'AC-2',
    'Account Management',
    'The organization manages information system accounts including identifying account types.',
    2);
  controls['old-ac3'] = insertControl(db, oldCatalogId, 'AC-3',
    'Access Enforcement',
    'The information system enforces approved authorizations for logical access.',
    3);
  controls['old-ac4'] = insertControl(db, oldCatalogId, 'AC-4',
    'Information Flow Enforcement',
    'The information system enforces approved authorizations for controlling the flow of information within the system and between interconnected systems.',
    4);
  controls['old-ac5'] = insertControl(db, oldCatalogId, 'AC-5',
    'Separation of Duties',
    'The organization separates duties of individuals as necessary to prevent malicious activity.',
    5);

  // NEW controls
  controls['new-ac1'] = insertControl(db, newCatalogId, 'AC-1',
    'Access Control Policy',
    'The organization develops, documents, and disseminates an access control policy.',
    1);
  controls['new-ac2'] = insertControl(db, newCatalogId, 'AC-2',
    'Account Management',
    'The organization manages system accounts, including defining account types, establishing conditions for membership, and specifying authorized users and access privileges.',
    2);
  controls['new-ac5'] = insertControl(db, newCatalogId, 'AC-5',
    'Separation of Duties',
    'The organization separates duties of individuals as necessary to prevent malicious activity.',
    3);
  controls['new-ac40'] = insertControl(db, newCatalogId, 'AC-40',
    'Information Flow Enforcement',
    'The information system enforces approved authorizations for controlling the flow of information within the system and between interconnected systems.',
    4);
  controls['new-ac6'] = insertControl(db, newCatalogId, 'AC-6',
    'Least Privilege',
    'The organization employs the principle of least privilege, allowing only authorized accesses for users.',
    5);

  // Create org with implementations for some old controls
  const orgId = generateUuid();
  db.prepare(
    'INSERT INTO organizations (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
  ).run(orgId, 'Test Org', t(), t());

  // Implementation for AC-1 (unchanged) and AC-2 (modified) and AC-4 (renumbered)
  const insertImpl = db.prepare(
    `INSERT INTO implementations (id, org_id, primary_control_id, status, statement, created_at, updated_at)
     VALUES (?, ?, ?, 'implemented', ?, ?, ?)`
  );
  insertImpl.run(generateUuid(), orgId, controls['old-ac1'], 'AC-1 is implemented via SSO.', t(), t());
  insertImpl.run(generateUuid(), orgId, controls['old-ac2'], 'AC-2 uses Active Directory.', t(), t());
  insertImpl.run(generateUuid(), orgId, controls['old-ac4'], 'AC-4 uses network segmentation.', t(), t());

  // Add a mapping from old-ac3 to test affected mappings
  db.prepare(
    `INSERT INTO control_mappings (id, source_control_id, target_control_id, relationship, confidence, source, created_at)
     VALUES (?, ?, ?, 'related', 'high', 'manual', ?)`
  ).run(generateUuid(), controls['old-ac3'], controls['old-ac1'], t());

  // Update catalog totals
  db.prepare('UPDATE catalogs SET total_controls = 5 WHERE id = ?').run(oldCatalogId);
  db.prepare('UPDATE catalogs SET total_controls = 5 WHERE id = ?').run(newCatalogId);

  return { oldCatalogId, newCatalogId, orgId, controls };
}

// ---------------------------------------------------------------------------
// Tests: wordDiff utility
// ---------------------------------------------------------------------------

describe('wordDiff', () => {
  it('returns perfect similarity for identical text', () => {
    const result = wordDiff('hello world', 'hello world');
    expect(result.similarity).toBe(1);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
  });

  it('returns 0 similarity for completely different text', () => {
    const result = wordDiff('alpha beta', 'gamma delta');
    expect(result.similarity).toBe(0);
    expect(result.removed).toContain('alpha');
    expect(result.removed).toContain('beta');
    expect(result.added).toContain('gamma');
    expect(result.added).toContain('delta');
  });

  it('handles partial overlap', () => {
    const result = wordDiff('the quick brown fox', 'the slow brown dog');
    expect(result.similarity).toBeGreaterThan(0);
    expect(result.similarity).toBeLessThan(1);
    expect(result.shared).toContain('the');
    expect(result.shared).toContain('brown');
    expect(result.removed).toContain('quick');
    expect(result.removed).toContain('fox');
    expect(result.added).toContain('slow');
    expect(result.added).toContain('dog');
  });

  it('handles empty strings', () => {
    const result = wordDiff('', '');
    expect(result.similarity).toBe(1);
  });

  it('strips punctuation for comparison', () => {
    const result = wordDiff('Hello, World!', 'hello world');
    expect(result.similarity).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: textSimilarity utility
// ---------------------------------------------------------------------------

describe('textSimilarity', () => {
  it('returns 1 for identical text', () => {
    expect(textSimilarity('same text here', 'same text here')).toBe(1);
  });

  it('returns 0 for completely different text', () => {
    expect(textSimilarity('alpha beta', 'gamma delta')).toBe(0);
  });

  it('returns high similarity for minor changes', () => {
    const sim = textSimilarity(
      'The organization manages information system accounts',
      'The organization manages information system accounts including identifying'
    );
    expect(sim).toBeGreaterThan(0.7);
  });

  it('returns low similarity for major rewrites', () => {
    const sim = textSimilarity(
      'Log all access events',
      'Implement continuous monitoring with automated alerting'
    );
    expect(sim).toBeLessThan(0.3);
  });
});

// ---------------------------------------------------------------------------
// Tests: diffCatalogs
// ---------------------------------------------------------------------------

describe('diffCatalogs', () => {
  let db: Database.Database;
  let seed: ReturnType<typeof seedFixtureCatalogs>;

  beforeEach(() => {
    db = createTestDb();
    seed = seedFixtureCatalogs(db);
  });

  it('returns correct summary counts', () => {
    const result = diffCatalogs('fw-v1', 'fw-v2', db, seed.orgId);
    expect(result.summary.unchanged).toBe(2);  // AC-1, AC-5
    expect(result.summary.modified).toBe(1);    // AC-2
    expect(result.summary.removed).toBe(1);     // AC-3
    expect(result.summary.renumbered).toBe(1);  // AC-4 → AC-40
    expect(result.summary.added).toBe(1);       // AC-6
  });

  it('identifies unchanged controls correctly', () => {
    const result = diffCatalogs('fw-v1', 'fw-v2', db);
    const unchangedIds = result.unchanged.map((c) => c.newControl!.control_id).sort();
    expect(unchangedIds).toEqual(['AC-1', 'AC-5']);
  });

  it('identifies modified controls with description diff', () => {
    const result = diffCatalogs('fw-v1', 'fw-v2', db);
    expect(result.modified).toHaveLength(1);
    const mod = result.modified[0];
    expect(mod.newControl!.control_id).toBe('AC-2');
    expect(mod.descriptionDiff).toBeDefined();
    expect(mod.descriptionDiff!.similarity).toBeGreaterThan(0);
    expect(mod.descriptionDiff!.similarity).toBeLessThan(1);
    expect(mod.severity).toBeDefined();
  });

  it('identifies removed controls', () => {
    const result = diffCatalogs('fw-v1', 'fw-v2', db);
    expect(result.removed).toHaveLength(1);
    expect(result.removed[0].oldControl!.control_id).toBe('AC-3');
  });

  it('detects renumbered controls by description similarity', () => {
    const result = diffCatalogs('fw-v1', 'fw-v2', db);
    expect(result.renumbered).toHaveLength(1);
    const renum = result.renumbered[0];
    expect(renum.renumberedFrom).toBe('AC-4');
    expect(renum.newControl!.control_id).toBe('AC-40');
  });

  it('identifies added controls', () => {
    const result = diffCatalogs('fw-v1', 'fw-v2', db);
    expect(result.added).toHaveLength(1);
    expect(result.added[0].newControl!.control_id).toBe('AC-6');
    expect(result.added[0].actionNeeded).toBe('new-implementation-required');
  });

  it('flags existing implementations on modified controls', () => {
    const result = diffCatalogs('fw-v1', 'fw-v2', db, seed.orgId);
    const mod = result.modified[0];
    expect(mod.hasExistingImpl).toBe(true);
    expect(mod.actionNeeded).toBe('review-implementation');
  });

  it('flags existing implementations on renumbered controls', () => {
    const result = diffCatalogs('fw-v1', 'fw-v2', db, seed.orgId);
    const renum = result.renumbered[0];
    expect(renum.hasExistingImpl).toBe(true);
  });

  it('detects affected mappings on removed controls', () => {
    const result = diffCatalogs('fw-v1', 'fw-v2', db, seed.orgId);
    const removed = result.removed[0];
    expect(removed.affectedMappings.length).toBeGreaterThan(0);
    expect(removed.affectedMappings[0]).toContain('AC-1');
  });

  it('reports no changes for identical catalogs', () => {
    // Diff a catalog against itself
    const result = diffCatalogs('fw-v1', 'fw-v1', db);
    expect(result.summary.added).toBe(0);
    expect(result.summary.removed).toBe(0);
    expect(result.summary.modified).toBe(0);
    expect(result.summary.renumbered).toBe(0);
    expect(result.summary.unchanged).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Tests: severity classification
// ---------------------------------------------------------------------------

describe('modification severity', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('classifies minor changes (>80% similarity)', () => {
    const oldCatId = createCatalog(db, 'sev-old', 'Severity Old');
    const newCatId = createCatalog(db, 'sev-new', 'Severity New');

    insertControl(db, oldCatId, 'C-1', 'Control One',
      'The organization implements a policy for managing access to information systems.', 1);
    insertControl(db, newCatId, 'C-1', 'Control One',
      'The organization implements a policy for managing access to information systems and networks.', 1);

    const result = diffCatalogs('sev-old', 'sev-new', db);
    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].severity).toBe('minor');
  });

  it('classifies major changes (<50% similarity)', () => {
    const oldCatId = createCatalog(db, 'maj-old', 'Major Old');
    const newCatId = createCatalog(db, 'maj-new', 'Major New');

    insertControl(db, oldCatId, 'C-1', 'Audit Logging',
      'The system generates audit records for all access events.', 1);
    insertControl(db, newCatId, 'C-1', 'Continuous Monitoring',
      'Implement automated security monitoring with real-time alerting and response capabilities across all environments.', 1);

    const result = diffCatalogs('maj-old', 'maj-new', db);
    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].severity).toBe('major');
  });
});
