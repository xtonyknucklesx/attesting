import * as ExcelJS from 'exceljs';
import Database from 'better-sqlite3';
import { execSync } from 'node:child_process';
import { generateUuid } from '../utils/uuid.js';
import { now } from '../utils/dates.js';

/**
 * Result returned after importing a SIG Content Library worksheet.
 */
export interface SigImportResult {
  imported: number;
  mappingsExtracted: number;
  errors: string[];
  /** Column headers for mapping reference columns (K onward). */
  frameworkColumns: string[];
}

/**
 * A single cross-framework mapping reference extracted from the SIG spreadsheet.
 */
export interface ExtractedMapping {
  sigQuestionNumber: string;
  framework: string;
  reference: string;
}

/**
 * Worksheet names to try when looking for the Content Library tab.
 */
const CONTENT_LIBRARY_NAMES = [
  'Content Library',
  'ContentLibrary',
  'SIG Content Library',
];

/**
 * Column indices (0-based) for fixed SIG columns.
 */
const COL = {
  INCLUDE_EXCLUDE: 0,   // A
  SERIAL_NO: 1,         // B
  QUESTION_NUMBER: 2,   // C
  QUESTION_TEXT: 3,     // D
  MASTER_RESPONSE: 4,   // E
  COMMENTS: 5,          // F
  IMPORTANCE: 6,        // G
  CONTROL_FAMILY: 7,    // H
  CONTROL_ATTRIBUTE: 8, // I
  SCOPE_LEVEL: 9,       // J
  MAPPING_START: 10,    // K onward
} as const;

// ============================================================
// Low-level ZIP+XML extraction (fallback for VML parse errors)
// ============================================================

/** Extract a single entry from a ZIP/XLSM by path, returning its text content. */
function extractZipEntry(zipPath: string, entryPath: string): string | null {
  try {
    const buf = execSync(`unzip -p "${zipPath}" "${entryPath}"`, {
      maxBuffer: 50 * 1024 * 1024,
    });
    return buf.toString('utf-8');
  } catch {
    return null;
  }
}

/** Decode the XML entities that appear in OOXML cell text. */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    // Strip any remaining numeric / named entities that snuck through
    .replace(/&#x[0-9a-fA-F]+;/g, '')
    .replace(/&#\d+;/g, '')
    .replace(/&[a-zA-Z]+;/g, '');
}

/**
 * Parse xl/sharedStrings.xml and return the indexed string array.
 * Each <si> element is one entry; rich-text <r><t> fragments are concatenated.
 */
function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  // Match every <si>…</si> block (non-greedy, dotall via [\s\S])
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  let siMatch: RegExpExecArray | null;
  while ((siMatch = siRe.exec(xml)) !== null) {
    const siContent = siMatch[1];
    // Collect all <t>…</t> fragments (handles plain and rich text)
    const tRe = /<t(?:\s[^>]*)?>([^<]*)<\/t>/g;
    let tMatch: RegExpExecArray | null;
    let text = '';
    while ((tMatch = tRe.exec(siContent)) !== null) {
      text += tMatch[1];
    }
    strings.push(decodeXmlEntities(text));
  }
  return strings;
}

/**
 * Given xl/workbook.xml, return a map of { sheetName → rId } for all sheets.
 * Sheet name attributes may use XML entities, so we decode them.
 */
function parseSheetRefs(workbookXml: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /<sheet\s[^>]*?name="([^"]*)"[^>]*?r:id="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(workbookXml)) !== null) {
    map.set(decodeXmlEntities(m[1]), m[2]);
  }
  return map;
}

/**
 * Given xl/_rels/workbook.xml.rels, return a map of { rId → target path }.
 * Target paths are relative to xl/, e.g. "worksheets/sheet3.xml".
 */
function parseWorkbookRels(relsXml: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /<Relationship\s[^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(relsXml)) !== null) {
    map.set(m[1], m[2]);
  }
  return map;
}

/**
 * Convert a column letter (or multi-letter) address to a 0-based index.
 * "A" → 0, "B" → 1, "Z" → 25, "AA" → 26, etc.
 */
function colLetterToIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

/**
 * Split a cell reference like "AB12" into { col: "AB", row: 12 }.
 */
function splitCellRef(ref: string): { col: string; row: number } {
  const m = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!m) return { col: 'A', row: 1 };
  return { col: m[1].toUpperCase(), row: parseInt(m[2], 10) };
}

/**
 * Parse a single worksheet XML and return rows as a sparse array of string[].
 * rows[rowIndex][colIndex] = cell text (or undefined if empty).
 * Row and col indices are 0-based.
 */
function parseWorksheetXml(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];

  // Match each <row …>…</row> block
  const rowRe = /<row\s[^>]*?>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRe.exec(xml)) !== null) {
    const rowContent = rowMatch[1];

    // Match each <c …>…</c> within the row
    const cellRe = /<c\s([^>]*)>([\s\S]*?)<\/c>/g;
    let cellMatch: RegExpExecArray | null;

    const rowData: string[] = [];

    while ((cellMatch = cellRe.exec(rowContent)) !== null) {
      const attrs = cellMatch[1];
      const cellContent = cellMatch[2];

      // Extract cell reference (r="B4") and type (t="s"|"inlineStr"|"str"|"b"|"e")
      const rMatch = attrs.match(/\br="([A-Z]+\d+)"/i);
      const tMatch = attrs.match(/\bt="([^"]+)"/);
      if (!rMatch) continue;

      const { col } = splitCellRef(rMatch[1]);
      const colIdx = colLetterToIndex(col);
      const cellType = tMatch ? tMatch[1] : '';

      let value = '';

      if (cellType === 's') {
        // Shared string index
        const vMatch = cellContent.match(/<v>([^<]*)<\/v>/);
        if (vMatch) {
          const idx = parseInt(vMatch[1], 10);
          value = sharedStrings[idx] ?? '';
        }
      } else if (cellType === 'inlineStr') {
        // Inline string: collect all <t> fragments
        const tRe = /<t(?:\s[^>]*)?>([^<]*)<\/t>/g;
        let tm: RegExpExecArray | null;
        while ((tm = tRe.exec(cellContent)) !== null) {
          value += tm[1];
        }
        value = decodeXmlEntities(value);
      } else if (cellType === 'str') {
        // Formula result string
        const vMatch = cellContent.match(/<v>([^<]*)<\/v>/);
        if (vMatch) value = decodeXmlEntities(vMatch[1]);
      } else {
        // Number or bool — just grab <v>
        const vMatch = cellContent.match(/<v>([^<]*)<\/v>/);
        if (vMatch) value = vMatch[1];
      }

      rowData[colIdx] = value.trim();
    }

    rows.push(rowData);
  }

  return rows;
}

/**
 * Low-level reader: unzips the .xlsm and parses only the worksheet we need.
 * Returns rows as string[][], skipping all VML/drawing content.
 */
function readSheetViaUnzip(
  filePath: string,
  targetSheetNames: string[]
): { rows: string[][]; sheetFound: string | null } {
  // 1. Read workbook.xml to map sheet names → rIds
  const workbookXml = extractZipEntry(filePath, 'xl/workbook.xml');
  if (!workbookXml) {
    return { rows: [], sheetFound: null };
  }

  const sheetRefs = parseSheetRefs(workbookXml);

  // 2. Find which rId belongs to the Content Library sheet
  let targetRId: string | null = null;
  let sheetFound: string | null = null;
  for (const name of targetSheetNames) {
    const rId = sheetRefs.get(name);
    if (rId) {
      targetRId = rId;
      sheetFound = name;
      break;
    }
  }

  // If exact match failed, try case-insensitive
  if (!targetRId) {
    for (const [name, rId] of sheetRefs) {
      if (targetSheetNames.some((n) => n.toLowerCase() === name.toLowerCase())) {
        targetRId = rId;
        sheetFound = name;
        break;
      }
    }
  }

  if (!targetRId) {
    // List available sheet names for diagnostics
    const available = [...sheetRefs.keys()].join(', ');
    throw new Error(
      `Could not find Content Library worksheet. Available sheets: ${available}`
    );
  }

  // 3. Resolve rId → actual file path via workbook.xml.rels
  const relsXml = extractZipEntry(filePath, 'xl/_rels/workbook.xml.rels') ?? '';
  const rels = parseWorkbookRels(relsXml);
  const target = rels.get(targetRId);
  if (!target) {
    throw new Error(`Could not resolve rId ${targetRId} to a worksheet path`);
  }

  // target is relative to xl/, e.g. "worksheets/sheet3.xml"
  const sheetEntryPath = `xl/${target}`;

  // 4. Load shared strings
  const ssXml = extractZipEntry(filePath, 'xl/sharedStrings.xml') ?? '';
  const sharedStrings = ssXml ? parseSharedStrings(ssXml) : [];

  // 5. Extract and parse only the target worksheet — VML files are never touched
  const sheetXml = extractZipEntry(filePath, sheetEntryPath);
  if (!sheetXml) {
    throw new Error(`Could not extract worksheet: ${sheetEntryPath}`);
  }

  const rows = parseWorksheetXml(sheetXml, sharedStrings);
  return { rows, sheetFound };
}

// ============================================================
// Shared helpers (used by both exceljs and low-level paths)
// ============================================================

function getParentQuestionNumber(questionNumber: string): string | null {
  const parts = questionNumber.split('.');
  if (parts.length <= 2) return null;
  return parts.slice(0, parts.length - 1).join('.');
}

function extractRiskDomain(questionNumber: string): string {
  return questionNumber.split('.')[0] ?? questionNumber;
}

/** Returns trimmed string or null for an ExcelJS cell. */
function getCellText(cell: ExcelJS.Cell): string | null {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && 'richText' in v) {
    const rich = (v as ExcelJS.CellRichTextValue).richText;
    const text = rich.map((r) => r.text).join('').trim();
    return text || null;
  }
  const str = String(v).trim();
  return str || null;
}

/** Returns true if the error looks like an exceljs/saxes VML XML parse failure. */
function isVmlParseError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('malformed character entity') ||
    msg.includes('saxes') ||
    msg.includes('character entity') ||
    msg.includes('SAXParseException') ||
    msg.includes('not well-formed') ||
    msg.includes('invalid character')
  );
}

// ============================================================
// Core import logic — shared between exceljs and low-level paths
// ============================================================

interface RawRow {
  rowNumber: number;
  cells: (string | null)[];
}

/**
 * Processes raw rows (from either exceljs or the low-level parser) and
 * inserts controls into the database.
 */
function processRows(
  rawRows: RawRow[],
  catalogId: string,
  db: Database.Database,
  scopeLevel: string | undefined,
  result: { imported: number; mappingsExtracted: number; errors: string[]; frameworkColumns: string[] }
): ExtractedMapping[] {
  if (rawRows.length === 0) return [];

  // Row 0 is the header — extract framework columns (K+)
  const headerCells = rawRows[0]?.cells ?? [];
  for (let i = COL.MAPPING_START; i < headerCells.length; i++) {
    const h = headerCells[i]?.trim();
    if (h) result.frameworkColumns.push(h);
  }

  const dataRows = rawRows.slice(1);

  // First pass: build questionNumber → UUID map (only for included rows)
  const questionUuidMap = new Map<string, string>();
  for (const row of dataRows) {
    const includeExclude = (row.cells[COL.INCLUDE_EXCLUDE] ?? '').toLowerCase();
    const questionNumber = row.cells[COL.QUESTION_NUMBER]?.trim() ?? '';
    if (!questionNumber || includeExclude === 'exclude' || !includeExclude) continue;
    questionUuidMap.set(questionNumber, generateUuid());
  }

  const insert = db.prepare(
    `INSERT INTO controls
       (id, catalog_id, control_id, parent_control_id, title, description, guidance,
        metadata, sig_risk_domain, sig_control_family, sig_control_attribute,
        sig_scope_level, sig_serial_no, sig_importance, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const allMappings: ExtractedMapping[] = [];

  const insertAll = db.transaction(() => {
    let sortOrder = 0;

    for (const row of dataRows) {
      const includeExclude = (row.cells[COL.INCLUDE_EXCLUDE] ?? '').toLowerCase();
      const questionNumber = row.cells[COL.QUESTION_NUMBER]?.trim() ?? '';

      if (!questionNumber || includeExclude === 'exclude' || !includeExclude) continue;

      const scopeLevelCell = row.cells[COL.SCOPE_LEVEL]?.trim() ?? null;
      if (scopeLevel && scopeLevelCell) {
        if (scopeLevelCell.toLowerCase() !== scopeLevel.toLowerCase()) continue;
      }

      const serialNo = row.cells[COL.SERIAL_NO] ? Number(row.cells[COL.SERIAL_NO]) : null;
      const questionText = row.cells[COL.QUESTION_TEXT]?.trim() || null;
      const masterResponse = row.cells[COL.MASTER_RESPONSE]?.trim() || null;
      const comments = row.cells[COL.COMMENTS]?.trim() || null;
      const importance = row.cells[COL.IMPORTANCE]?.trim() || null;
      const controlFamily = row.cells[COL.CONTROL_FAMILY]?.trim() || null;
      const controlAttribute = row.cells[COL.CONTROL_ATTRIBUTE]?.trim() || null;
      const riskDomain = extractRiskDomain(questionNumber);

      const parentQN = getParentQuestionNumber(questionNumber);
      const parentUuid = parentQN ? (questionUuidMap.get(parentQN) ?? null) : null;
      const controlUuid = questionUuidMap.get(questionNumber);
      if (!controlUuid) continue;

      // Extract mapping references from columns K+ (before building metadata)
      const mappingRefs: Record<string, string> = {};
      result.frameworkColumns.forEach((framework, idx) => {
        const ref = row.cells[COL.MAPPING_START + idx]?.trim() || null;
        if (ref) {
          mappingRefs[framework] = ref;
          allMappings.push({ sigQuestionNumber: questionNumber, framework, reference: ref });
          result.mappingsExtracted++;
        }
      });

      const metadata = JSON.stringify({
        risk_domain: riskDomain,
        control_family: controlFamily ?? '',
        control_attribute: controlAttribute ?? '',
        scope_level: scopeLevelCell ?? '',
        serial_no: isNaN(serialNo as number) ? null : serialNo,
        master_response: masterResponse ?? '',
        comments: comments ?? '',
        mapping_references: mappingRefs,
      });

      try {
        insert.run(
          controlUuid, catalogId, questionNumber, parentUuid,
          questionText ?? questionNumber, questionText, comments, metadata,
          riskDomain, controlFamily, controlAttribute, scopeLevelCell,
          isNaN(serialNo as number) ? null : serialNo,
          importance, sortOrder++, now()
        );
        result.imported++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Row ${row.rowNumber} (${questionNumber}): ${msg}`);
        continue;
      }
    }
  });

  insertAll();
  return allMappings;
}

// ============================================================
// ExcelJS path
// ============================================================

async function readSheetViaExcelJs(
  filePath: string,
  targetSheetNames: string[]
): Promise<{ rows: RawRow[]; sheetFound: string | null }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  let worksheet: ExcelJS.Worksheet | undefined;
  let sheetFound: string | null = null;
  for (const name of targetSheetNames) {
    const ws = workbook.getWorksheet(name);
    if (ws) {
      worksheet = ws;
      sheetFound = name;
      break;
    }
  }

  if (!worksheet) {
    const names = workbook.worksheets.map((ws) => ws.name).join(', ');
    throw new Error(`Could not find Content Library worksheet. Available sheets: ${names}`);
  }

  const rows: RawRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cells: (string | null)[] = [];
    // eachCell is 1-based; pad the array to match 0-based COL indices
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cells[colNumber - 1] = getCellText(cell) ?? getCellNumberStr(cell);
    });
    rows.push({ rowNumber, cells });
  });

  return { rows, sheetFound };
}

function getCellNumberStr(cell: ExcelJS.Cell): string | null {
  const n = cell.value;
  if (n === null || n === undefined) return null;
  if (typeof n === 'number') return String(n);
  return null;
}

// ============================================================
// Low-level path adapter
// ============================================================

function readSheetViaUnzipAsRawRows(
  filePath: string,
  targetSheetNames: string[]
): { rows: RawRow[]; sheetFound: string | null } {
  const { rows: matrix, sheetFound } = readSheetViaUnzip(filePath, targetSheetNames);

  const rawRows: RawRow[] = matrix.map((cells, i) => ({
    rowNumber: i + 1,
    cells: cells.map((c) => (c !== undefined ? c : null)),
  }));

  return { rows: rawRows, sheetFound };
}

// ============================================================
// Public API
// ============================================================

/**
 * Imports controls from a SIG Manager Content Library worksheet into the database.
 * Tries exceljs first; if VML/XML parse errors occur, falls back to direct ZIP extraction.
 */
export async function importSigCatalog(
  filePath: string,
  catalogId: string,
  db: Database.Database,
  scopeLevel?: string
): Promise<SigImportResult> {
  const importResult: SigImportResult = {
    imported: 0,
    mappingsExtracted: 0,
    errors: [],
    frameworkColumns: [],
  };

  let rawRows: RawRow[];

  // Try exceljs first (handles formatting, rich text, etc.)
  try {
    const { rows } = await readSheetViaExcelJs(filePath, CONTENT_LIBRARY_NAMES);
    rawRows = rows;
  } catch (err) {
    if (isVmlParseError(err)) {
      // VML/VBA macros contain malformed XML entities — bypass exceljs entirely
      // and extract only the worksheet XML from the ZIP, skipping all drawings.
      try {
        const { rows } = readSheetViaUnzipAsRawRows(filePath, CONTENT_LIBRARY_NAMES);
        rawRows = rows;
      } catch (innerErr) {
        const msg = innerErr instanceof Error ? innerErr.message : String(innerErr);
        return { ...importResult, errors: [msg] };
      }
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      return { ...importResult, errors: [msg] };
    }
  }

  processRows(rawRows, catalogId, db, scopeLevel, importResult);
  return importResult;
}

/**
 * Extracts all cross-framework mapping references from a SIG file
 * without inserting anything into the database.
 * Falls back to ZIP extraction if exceljs fails on VML content.
 */
export async function extractSigMappings(
  filePath: string
): Promise<ExtractedMapping[]> {
  let rawRows: RawRow[];

  try {
    const { rows } = await readSheetViaExcelJs(filePath, CONTENT_LIBRARY_NAMES);
    rawRows = rows;
  } catch (err) {
    if (isVmlParseError(err)) {
      try {
        const { rows } = readSheetViaUnzipAsRawRows(filePath, CONTENT_LIBRARY_NAMES);
        rawRows = rows;
      } catch {
        return [];
      }
    } else {
      return [];
    }
  }

  if (rawRows.length < 2) return [];

  // Read framework column headers from header row
  const frameworkColumns: string[] = [];
  const headerCells = rawRows[0]?.cells ?? [];
  for (let i = COL.MAPPING_START; i < headerCells.length; i++) {
    const h = headerCells[i]?.trim();
    if (h) frameworkColumns.push(h);
  }

  const results: ExtractedMapping[] = [];
  for (const row of rawRows.slice(1)) {
    const includeExclude = (row.cells[COL.INCLUDE_EXCLUDE] ?? '').toLowerCase();
    const questionNumber = row.cells[COL.QUESTION_NUMBER]?.trim() ?? '';
    if (!questionNumber || includeExclude === 'exclude' || !includeExclude) continue;

    frameworkColumns.forEach((framework, idx) => {
      const ref = row.cells[COL.MAPPING_START + idx]?.trim() || null;
      if (ref) results.push({ sigQuestionNumber: questionNumber, framework, reference: ref });
    });
  }

  return results;
}
