import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import Database from 'better-sqlite3';

// Import the importer and parser we want to test
import { importCsvCatalog, parseCsv } from '../../src/importers/csv-generic.js';

// We patch the db singleton to point at our in-memory test database
import * as connection from '../../src/db/connection.js';

const FIXTURE_PATH = path.join(
  __dirname,
  'fixtures/test-catalog.csv'
);

const SCHEMA_PATH = path.join(__dirname, '../../src/db/schema.sql');

/**
 * Opens a fresh in-memory database with the full schema applied.
 */
function openTestDb(): Database.Database {
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(sql);
  return db;
}

/**
 * Creates a minimal catalog row and returns its id.
 */
function insertTestCatalog(db: Database.Database, shortName: string): string {
  const id = `catalog-${shortName}`;
  db.prepare(
    `INSERT INTO catalogs (id, name, short_name, source_format, created_at, updated_at)
     VALUES (?, ?, ?, 'csv', datetime('now'), datetime('now'))`
  ).run(id, `Test Catalog ${shortName}`, shortName);
  return id;
}

describe('parseCsv', () => {
  it('parses a simple CSV correctly', () => {
    const csv = 'a,b,c\n1,2,3\n4,5,6\n';
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual(['a', 'b', 'c']);
    expect(rows[1]).toEqual(['1', '2', '3']);
    expect(rows[2]).toEqual(['4', '5', '6']);
  });

  it('handles quoted fields with commas', () => {
    const csv = 'id,"title, with comma",desc\nCTL-001,"Access, Control","Some desc"\n';
    const rows = parseCsv(csv);
    expect(rows[1][1]).toBe('Access, Control');
    expect(rows[1][2]).toBe('Some desc');
  });

  it('handles doubled quotes inside quoted fields', () => {
    const csv = 'id,notes\nCTL-001,"He said ""hello"""\n';
    const rows = parseCsv(csv);
    expect(rows[1][1]).toBe('He said "hello"');
  });
});

describe('importCsvCatalog', () => {
  let testDb: Database.Database;
  let originalGetDb: () => Database.Database;

  beforeEach(() => {
    testDb = openTestDb();
    // Monkey-patch the singleton so the importer uses our test DB
    originalGetDb = connection.db.getDb.bind(connection.db);
    connection.db.getDb = () => testDb;
  });

  afterEach(() => {
    connection.db.getDb = originalGetDb;
    testDb.close();
  });

  it('imports all 5 controls from the fixture file', () => {
    const catalogId = insertTestCatalog(testDb, 'test-ctl');

    const result = importCsvCatalog(FIXTURE_PATH, catalogId, {
      control_id: 'A',
      title: 'B',
      description: 'C',
    });

    expect(result.errors).toHaveLength(0);
    expect(result.imported).toBe(5);
  });

  it('populates control fields correctly', () => {
    const catalogId = insertTestCatalog(testDb, 'test-ctl-2');

    importCsvCatalog(FIXTURE_PATH, catalogId, {
      control_id: 'A',
      title: 'B',
      description: 'C',
    });

    const ctrl = testDb
      .prepare('SELECT * FROM controls WHERE catalog_id = ? AND control_id = ?')
      .get(catalogId, 'CTL-001') as {
      control_id: string;
      title: string;
      description: string;
    } | undefined;

    expect(ctrl).toBeDefined();
    expect(ctrl!.control_id).toBe('CTL-001');
    expect(ctrl!.title).toBe('Access Control Policy');
    expect(ctrl!.description).toBe(
      'The organization establishes and maintains an access control policy.'
    );
  });

  it('assigns sequential sort_order values', () => {
    const catalogId = insertTestCatalog(testDb, 'test-ctl-3');

    importCsvCatalog(FIXTURE_PATH, catalogId, {
      control_id: 'A',
      title: 'B',
      description: 'C',
    });

    const controls = testDb
      .prepare(
        'SELECT control_id, sort_order FROM controls WHERE catalog_id = ? ORDER BY sort_order ASC'
      )
      .all(catalogId) as { control_id: string; sort_order: number }[];

    expect(controls[0].sort_order).toBe(0);
    expect(controls[4].sort_order).toBe(4);
  });

  it('handles duplicate catalog import gracefully (UNIQUE constraint error per row)', () => {
    const catalogId = insertTestCatalog(testDb, 'test-ctl-4');

    // First import succeeds
    const first = importCsvCatalog(FIXTURE_PATH, catalogId, {
      control_id: 'A',
      title: 'B',
      description: 'C',
    });
    expect(first.imported).toBe(5);

    // Second import into the same catalog should fail per-row due to UNIQUE(catalog_id, control_id)
    const second = importCsvCatalog(FIXTURE_PATH, catalogId, {
      control_id: 'A',
      title: 'B',
      description: 'C',
    });

    // All rows should produce errors, none should be imported again
    expect(second.imported).toBe(0);
    expect(second.errors.length).toBeGreaterThan(0);
  });
});
