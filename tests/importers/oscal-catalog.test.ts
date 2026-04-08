/**
 * Tests for the OSCAL JSON catalog importer.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import { importOscalCatalog } from '../../src/importers/oscal-catalog.js';

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'test-oscal-catalog.json');
const SCHEMA_PATH = path.join(__dirname, '../../src/db/schema.sql');

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);
  return db;
}

function insertCatalog(db: Database.Database, id: string): void {
  db.prepare(
    `INSERT INTO catalogs (id, name, short_name, source_format, created_at, updated_at)
     VALUES (?, 'Test OSCAL Catalog', 'test-oscal', 'oscal', datetime('now'), datetime('now'))`
  ).run(id);
}

describe('importOscalCatalog', () => {
  it('imports the correct number of controls (4 total: 3 top-level + 1 enhancement)', () => {
    const db = createTestDb();
    const catalogId = 'cat-oscal-1';
    insertCatalog(db, catalogId);

    const result = importOscalCatalog(FIXTURE_PATH, catalogId, db);

    expect(result.errors).toHaveLength(0);
    // 3.1.1 + 3.1.1.a (enhancement) + 3.1.2 + 3.3.1 = 4 total
    expect(result.imported).toBe(4);

    const count = (
      db.prepare('SELECT COUNT(*) AS cnt FROM controls WHERE catalog_id = ?').get(catalogId) as { cnt: number }
    ).cnt;
    expect(count).toBe(4);
  });

  it('stores group title as metadata.family', () => {
    const db = createTestDb();
    const catalogId = 'cat-oscal-2';
    insertCatalog(db, catalogId);

    importOscalCatalog(FIXTURE_PATH, catalogId, db);

    const control = db
      .prepare(
        `SELECT metadata FROM controls WHERE catalog_id = ? AND control_id = '3.1.1'`
      )
      .get(catalogId) as { metadata: string } | undefined;

    expect(control).toBeDefined();
    const meta = JSON.parse(control!.metadata);
    expect(meta.family).toBe('Access Control');
  });

  it('extracts statement and guidance from parts', () => {
    const db = createTestDb();
    const catalogId = 'cat-oscal-3';
    insertCatalog(db, catalogId);

    importOscalCatalog(FIXTURE_PATH, catalogId, db);

    const control = db
      .prepare(
        `SELECT description, guidance FROM controls WHERE catalog_id = ? AND control_id = '3.1.1'`
      )
      .get(catalogId) as { description: string | null; guidance: string | null } | undefined;

    expect(control).toBeDefined();
    expect(control!.description).toContain('Limit information system access');
    expect(control!.guidance).toContain('Access control policies');
  });

  it('sets parent_control_id for nested control enhancements', () => {
    const db = createTestDb();
    const catalogId = 'cat-oscal-4';
    insertCatalog(db, catalogId);

    importOscalCatalog(FIXTURE_PATH, catalogId, db);

    // Get the parent (3.1.1)
    const parent = db
      .prepare(
        `SELECT id FROM controls WHERE catalog_id = ? AND control_id = '3.1.1'`
      )
      .get(catalogId) as { id: string } | undefined;

    expect(parent).toBeDefined();

    // Get the child (3.1.1.a)
    const child = db
      .prepare(
        `SELECT id, parent_control_id FROM controls WHERE catalog_id = ? AND control_id = '3.1.1.a'`
      )
      .get(catalogId) as { id: string; parent_control_id: string | null } | undefined;

    expect(child).toBeDefined();
    expect(child!.parent_control_id).toBe(parent!.id);
  });

  it('populates oscal_uuid on the catalog record', () => {
    const db = createTestDb();
    const catalogId = 'cat-oscal-5';
    insertCatalog(db, catalogId);

    importOscalCatalog(FIXTURE_PATH, catalogId, db);

    const catalog = db
      .prepare('SELECT oscal_uuid FROM catalogs WHERE id = ?')
      .get(catalogId) as { oscal_uuid: string | null } | undefined;

    expect(catalog?.oscal_uuid).toBe('test-oscal-uuid-12345');
  });

  it('top-level controls in AC group have no parent_control_id', () => {
    const db = createTestDb();
    const catalogId = 'cat-oscal-6';
    insertCatalog(db, catalogId);

    importOscalCatalog(FIXTURE_PATH, catalogId, db);

    const control = db
      .prepare(
        `SELECT parent_control_id FROM controls WHERE catalog_id = ? AND control_id = '3.1.2'`
      )
      .get(catalogId) as { parent_control_id: string | null } | undefined;

    expect(control).toBeDefined();
    expect(control!.parent_control_id).toBeNull();
  });

  it('handles missing file gracefully', () => {
    const db = createTestDb();
    const catalogId = 'cat-oscal-7';
    insertCatalog(db, catalogId);

    const result = importOscalCatalog('/nonexistent/path.json', catalogId, db);

    expect(result.imported).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
