/**
 * Tests for the SIG Content Library importer.
 *
 * Creates a minimal in-memory fixture spreadsheet using exceljs (no copyrighted
 * SIG content is included). Tests verify parsing, parent/child hierarchy,
 * mapping extraction, and scope-level filtering.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as ExcelJS from 'exceljs';
import Database from 'better-sqlite3';
import { importSigCatalog, extractSigMappings } from '../../src/importers/sig-content-library.js';

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'sig-sample.xlsx');
const SCHEMA_PATH = path.join(__dirname, '../../src/db/schema.sql');

// ---------------------------------------------------------------------------
// Fixture creation helpers
// ---------------------------------------------------------------------------

async function createFixture(): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Content Library');

  // Header row
  ws.addRow([
    'Include/Exclude',   // A
    'Serial No',         // B
    'Question Number',   // C
    'Question/Request',  // D
    'Master Response',   // E
    'Comments/Notes',    // F
    'Importance',        // G
    'Control Family',    // H
    'Control Attribute', // I
    'Scope Level',       // J
    'ISO 27001:2022',    // K
    'NIST SP 800-171 Rev 2', // L
  ]);

  // Data rows — 5 controls: A.1, A.1.1, A.1.2, B.1, B.1.1
  const rows = [
    ['Include', 1001, 'A.1',   'What is the risk management policy?',  'Yes', 'N/A', 'High', 'Risk Management', 'Policy', 'Lite', 'A.5.1', '3.1.1'],
    ['Include', 1002, 'A.1.1', 'Describe the risk assessment process.', 'Yes', '',   'High', 'Risk Management', 'Process', 'Core', 'A.5.2', '3.1.2'],
    ['Include', 1003, 'A.1.2', 'How often is risk reassessed?',         '',   '',   'Medium','Risk Management', 'Process', 'Detail','',     '3.1.3'],
    ['Include', 2001, 'B.1',   'Describe access control policy.',       'Yes', '',   'High', 'Access Control',  'Policy', 'Lite', 'A.9.1', '3.1.1'],
    ['Include', 2002, 'B.1.1', 'How are privileged accounts managed?', 'Yes', '',   'High', 'Access Control',  'Mgmt',   'Lite', 'A.9.2', '3.1.2'],
  ];

  for (const row of rows) {
    ws.addRow(row);
  }

  await workbook.xlsx.writeFile(FIXTURE_PATH);
}

// ---------------------------------------------------------------------------
// Test DB setup helpers
// ---------------------------------------------------------------------------

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
     VALUES (?, 'SIG Test', 'sig-test', 'sig-xlsm', datetime('now'), datetime('now'))`
  ).run(id);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await createFixture();
});

afterAll(() => {
  if (fs.existsSync(FIXTURE_PATH)) {
    fs.unlinkSync(FIXTURE_PATH);
  }
});

describe('importSigCatalog', () => {
  it('successfully reads the Content Library worksheet', async () => {
    const db = createTestDb();
    const catalogId = 'cat-sig-1';
    insertCatalog(db, catalogId);

    const result = await importSigCatalog(FIXTURE_PATH, catalogId, db);

    expect(result.errors).toHaveLength(0);
    expect(result.imported).toBeGreaterThan(0);
  });

  it('imports the correct number of controls (all 5)', async () => {
    const db = createTestDb();
    const catalogId = 'cat-sig-2';
    insertCatalog(db, catalogId);

    const result = await importSigCatalog(FIXTURE_PATH, catalogId, db);

    expect(result.imported).toBe(5);

    const count = (
      db.prepare('SELECT COUNT(*) AS cnt FROM controls WHERE catalog_id = ?').get(catalogId) as { cnt: number }
    ).cnt;
    expect(count).toBe(5);
  });

  it('extracts parent/child relationships correctly', async () => {
    const db = createTestDb();
    const catalogId = 'cat-sig-3';
    insertCatalog(db, catalogId);

    await importSigCatalog(FIXTURE_PATH, catalogId, db);

    // A.1 should have no parent
    const a1 = db
      .prepare(
        `SELECT c.id, c.parent_control_id
           FROM controls c
          WHERE c.catalog_id = ? AND c.control_id = 'A.1'`
      )
      .get(catalogId) as { id: string; parent_control_id: string | null } | undefined;

    expect(a1).toBeDefined();
    expect(a1!.parent_control_id).toBeNull();

    // A.1.1 should have parent_control_id = A.1's UUID
    const a11 = db
      .prepare(
        `SELECT c.id, c.parent_control_id
           FROM controls c
          WHERE c.catalog_id = ? AND c.control_id = 'A.1.1'`
      )
      .get(catalogId) as { id: string; parent_control_id: string | null } | undefined;

    expect(a11).toBeDefined();
    expect(a11!.parent_control_id).toBe(a1!.id);

    // A.1.2's parent should also be A.1
    const a12 = db
      .prepare(
        `SELECT c.parent_control_id
           FROM controls c
          WHERE c.catalog_id = ? AND c.control_id = 'A.1.2'`
      )
      .get(catalogId) as { parent_control_id: string | null } | undefined;

    expect(a12!.parent_control_id).toBe(a1!.id);
  });

  it('extracts framework column headers correctly', async () => {
    const db = createTestDb();
    const catalogId = 'cat-sig-4';
    insertCatalog(db, catalogId);

    const result = await importSigCatalog(FIXTURE_PATH, catalogId, db);

    expect(result.frameworkColumns).toContain('ISO 27001:2022');
    expect(result.frameworkColumns).toContain('NIST SP 800-171 Rev 2');
    expect(result.mappingsExtracted).toBeGreaterThan(0);
  });

  it('scope level filtering imports only matching controls', async () => {
    const db = createTestDb();
    const catalogId = 'cat-sig-5';
    insertCatalog(db, catalogId);

    // Only 'Lite' controls: A.1, B.1, B.1.1 = 3
    const result = await importSigCatalog(FIXTURE_PATH, catalogId, db, 'Lite');

    expect(result.imported).toBe(3);

    const count = (
      db.prepare('SELECT COUNT(*) AS cnt FROM controls WHERE catalog_id = ?').get(catalogId) as { cnt: number }
    ).cnt;
    expect(count).toBe(3);
  });
});

describe('extractSigMappings', () => {
  it('extracts ISO 27001 mapping references', async () => {
    const mappings = await extractSigMappings(FIXTURE_PATH);

    const isoMappings = mappings.filter((m) => m.framework === 'ISO 27001:2022');
    expect(isoMappings.length).toBeGreaterThan(0);

    // A.1 maps to A.5.1
    const a1Iso = isoMappings.find((m) => m.sigQuestionNumber === 'A.1');
    expect(a1Iso?.reference).toBe('A.5.1');
  });

  it('extracts NIST mapping references', async () => {
    const mappings = await extractSigMappings(FIXTURE_PATH);

    const nistMappings = mappings.filter((m) => m.framework === 'NIST SP 800-171 Rev 2');
    expect(nistMappings.length).toBeGreaterThan(0);
  });

  it('only includes rows that are not Excluded', async () => {
    // All rows in the fixture are 'Include', so all should appear
    const mappings = await extractSigMappings(FIXTURE_PATH);
    const questionNumbers = new Set(mappings.map((m) => m.sigQuestionNumber));

    expect(questionNumbers.has('A.1')).toBe(true);
    expect(questionNumbers.has('A.1.1')).toBe(true);
  });
});
