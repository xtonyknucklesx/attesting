import * as ExcelJS from 'exceljs';
import Database from 'better-sqlite3';
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

/**
 * Extracts the parent question number from a child question number.
 * e.g. "A.1.1" -> "A.1", "A.1" -> null (no parent)
 */
function getParentQuestionNumber(questionNumber: string): string | null {
  const parts = questionNumber.split('.');
  if (parts.length <= 2) {
    // e.g. "A.1" — top-level, no parent
    return null;
  }
  return parts.slice(0, parts.length - 1).join('.');
}

/**
 * Extracts the risk domain prefix from a question number.
 * e.g. "A.1" -> "A", "B.2.3" -> "B"
 */
function extractRiskDomain(questionNumber: string): string {
  return questionNumber.split('.')[0] ?? questionNumber;
}

/**
 * Returns the string cell value, trimmed, or null if empty/undefined.
 */
function getCellText(cell: ExcelJS.Cell): string | null {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  // Handle RichText objects
  if (typeof v === 'object' && 'richText' in v) {
    const rich = (v as ExcelJS.CellRichTextValue).richText;
    const text = rich.map((r) => r.text).join('').trim();
    return text || null;
  }
  const str = String(v).trim();
  return str || null;
}

/**
 * Returns a numeric cell value or null.
 */
function getCellNumber(cell: ExcelJS.Cell): number | null {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

/**
 * Imports controls from a SIG Manager Content Library worksheet into the database.
 *
 * @param filePath    Absolute path to the .xlsm/.xlsx file.
 * @param catalogId   UUID of the pre-created catalog record.
 * @param db          Open better-sqlite3 database instance.
 * @param scopeLevel  Optional filter: 'Lite' | 'Core' | 'Detail'. Imports all if omitted.
 */
export async function importSigCatalog(
  filePath: string,
  catalogId: string,
  db: Database.Database,
  scopeLevel?: string
): Promise<SigImportResult> {
  const errors: string[] = [];
  let imported = 0;
  let mappingsExtracted = 0;
  const frameworkColumns: string[] = [];

  // Load the workbook (read-only, no macro execution)
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  // Find the Content Library worksheet
  let worksheet: ExcelJS.Worksheet | undefined;
  for (const name of CONTENT_LIBRARY_NAMES) {
    const ws = workbook.getWorksheet(name);
    if (ws) {
      worksheet = ws;
      break;
    }
  }

  if (!worksheet) {
    const names = workbook.worksheets.map((ws) => ws.name).join(', ');
    return {
      imported: 0,
      mappingsExtracted: 0,
      errors: [
        `Could not find Content Library worksheet. Available sheets: ${names}`,
      ],
      frameworkColumns: [],
    };
  }

  // Read header row (row 1) to identify mapping reference columns (K+)
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell({ includeEmpty: false }, (cell, colNum) => {
    // colNum is 1-based; mapping columns start at col 11 (K)
    if (colNum >= COL.MAPPING_START + 1) {
      const text = getCellText(cell);
      if (text) {
        frameworkColumns.push(text);
      }
    }
  });

  // Build a map of questionNumber -> internal UUID for parent resolution
  // We do a first pass to collect all question numbers, then a second pass to insert
  const questionUuidMap = new Map<string, string>();

  // First pass: collect question numbers from valid rows
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    const includeExclude = getCellText(row.getCell(COL.INCLUDE_EXCLUDE + 1));
    const questionNumber = getCellText(row.getCell(COL.QUESTION_NUMBER + 1));

    if (!questionNumber) return;
    if (!includeExclude || includeExclude.toLowerCase() === 'exclude') return;

    // Assign UUID for this question
    questionUuidMap.set(questionNumber, generateUuid());
  });

  // Prepare insert statement
  const insert = db.prepare(
    `INSERT INTO controls
       (id, catalog_id, control_id, parent_control_id, title, description, guidance,
        metadata, sig_risk_domain, sig_control_family, sig_control_attribute,
        sig_scope_level, sig_serial_no, sig_importance, sort_order, created_at)
     VALUES
       (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  // Collect all extracted mappings for return
  const allMappings: ExtractedMapping[] = [];

  // Second pass: insert controls
  const insertAll = db.transaction(() => {
    let sortOrder = 0;

    worksheet!.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // skip header

      const includeExclude = getCellText(row.getCell(COL.INCLUDE_EXCLUDE + 1));
      const questionNumber = getCellText(row.getCell(COL.QUESTION_NUMBER + 1));

      if (!questionNumber) return;
      if (!includeExclude || includeExclude.toLowerCase() === 'exclude') return;

      const scopeLevelCell = getCellText(row.getCell(COL.SCOPE_LEVEL + 1));

      // Apply scope level filter if specified
      if (scopeLevel && scopeLevelCell) {
        if (scopeLevelCell.toLowerCase() !== scopeLevel.toLowerCase()) {
          return;
        }
      }

      const serialNo = getCellNumber(row.getCell(COL.SERIAL_NO + 1));
      const questionText = getCellText(row.getCell(COL.QUESTION_TEXT + 1));
      const masterResponse = getCellText(row.getCell(COL.MASTER_RESPONSE + 1));
      const comments = getCellText(row.getCell(COL.COMMENTS + 1));
      const importance = getCellText(row.getCell(COL.IMPORTANCE + 1));
      const controlFamily = getCellText(row.getCell(COL.CONTROL_FAMILY + 1));
      const controlAttribute = getCellText(row.getCell(COL.CONTROL_ATTRIBUTE + 1));

      const riskDomain = extractRiskDomain(questionNumber);

      // Resolve parent UUID
      const parentQN = getParentQuestionNumber(questionNumber);
      const parentUuid = parentQN ? (questionUuidMap.get(parentQN) ?? null) : null;

      const controlUuid = questionUuidMap.get(questionNumber);
      if (!controlUuid) return; // should not happen

      // Build metadata JSON
      const metadata = JSON.stringify({
        risk_domain: riskDomain,
        control_family: controlFamily ?? '',
        control_attribute: controlAttribute ?? '',
        scope_level: scopeLevelCell ?? '',
        serial_no: serialNo ?? null,
        master_response: masterResponse ?? '',
        comments: comments ?? '',
      });

      try {
        insert.run(
          controlUuid,
          catalogId,
          questionNumber,
          parentUuid,
          questionText ?? questionNumber, // title = question text (truncated later if needed)
          questionText,                   // description = full question text
          comments,                       // guidance = comments/notes
          metadata,
          riskDomain,
          controlFamily,
          controlAttribute,
          scopeLevelCell,
          serialNo,
          importance,
          sortOrder++,
          now()
        );
        imported++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Row ${rowNumber} (${questionNumber}): ${msg}`);
        return;
      }

      // Extract mapping references from columns K+
      frameworkColumns.forEach((framework, idx) => {
        // Column index in the row is MAPPING_START + 1 (1-based) + idx
        const cell = row.getCell(COL.MAPPING_START + 1 + idx);
        const ref = getCellText(cell);
        if (ref) {
          allMappings.push({
            sigQuestionNumber: questionNumber,
            framework,
            reference: ref,
          });
          mappingsExtracted++;
        }
      });
    });
  });

  insertAll();

  return {
    imported,
    mappingsExtracted,
    errors,
    frameworkColumns,
  };
}

/**
 * Extracts all cross-framework mapping references from a SIG file
 * without inserting anything into the database.
 *
 * @param filePath  Absolute path to the .xlsm/.xlsx file.
 */
export async function extractSigMappings(
  filePath: string
): Promise<ExtractedMapping[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  let worksheet: ExcelJS.Worksheet | undefined;
  for (const name of CONTENT_LIBRARY_NAMES) {
    const ws = workbook.getWorksheet(name);
    if (ws) {
      worksheet = ws;
      break;
    }
  }

  if (!worksheet) return [];

  // Read framework column headers (K+)
  const frameworkColumns: string[] = [];
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell({ includeEmpty: false }, (cell, colNum) => {
    if (colNum >= COL.MAPPING_START + 1) {
      const text = getCellText(cell);
      if (text) frameworkColumns.push(text);
    }
  });

  const results: ExtractedMapping[] = [];

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const includeExclude = getCellText(row.getCell(COL.INCLUDE_EXCLUDE + 1));
    const questionNumber = getCellText(row.getCell(COL.QUESTION_NUMBER + 1));

    if (!questionNumber) return;
    if (!includeExclude || includeExclude.toLowerCase() === 'exclude') return;

    frameworkColumns.forEach((framework, idx) => {
      const cell = row.getCell(COL.MAPPING_START + 1 + idx);
      const ref = getCellText(cell);
      if (ref) {
        results.push({ sigQuestionNumber: questionNumber, framework, reference: ref });
      }
    });
  });

  return results;
}
