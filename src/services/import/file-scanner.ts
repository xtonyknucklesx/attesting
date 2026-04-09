import fs from 'fs';
import path from 'path';

// ── Constants ────────────────────────────────────────────────

/** 10 MB hard cap. Catalog files should never be larger. */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Allowed extensions — nothing else gets through. */
const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.json', '.csv']);

/** MIME types we accept (matched against multer's detected mimetype). */
const ALLOWED_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/json',                                                  // .json
  'text/csv',                                                          // .csv
  'text/plain',                                                        // .csv fallback
  'application/octet-stream',                                          // generic binary fallback
]);

/** Known dangerous byte signatures (magic bytes). */
const DANGEROUS_SIGNATURES: { name: string; bytes: number[] }[] = [
  { name: 'ELF executable',     bytes: [0x7f, 0x45, 0x4c, 0x46] },
  { name: 'PE executable',      bytes: [0x4d, 0x5a] },
  { name: 'Mach-O executable',  bytes: [0xcf, 0xfa, 0xed, 0xfe] },
  { name: 'Shell script',       bytes: [0x23, 0x21] }, // #!
  { name: 'RAR archive',        bytes: [0x52, 0x61, 0x72, 0x21] },
  { name: '7z archive',         bytes: [0x37, 0x7a, 0xbc, 0xaf] },
  { name: 'gzip archive',       bytes: [0x1f, 0x8b] },
];

/** XLSX magic bytes: PK zip header (xlsx is a zip container). */
const XLSX_MAGIC = [0x50, 0x4b, 0x03, 0x04];

/** JSON must start with these characters (after optional BOM/whitespace). */
const JSON_VALID_STARTS = new Set(['{', '[', '"']);

// ── Scan Result ──────────────────────────────────────────────

export interface ScanResult {
  safe: boolean;
  rejected_reason?: string;
  file_size: number;
  extension: string;
  mime_type?: string;
  checks_passed: string[];
}

// ── Scanner ──────────────────────────────────────────────────

/**
 * Scan an uploaded file for safety before processing.
 * Checks: extension, MIME type, file size, magic bytes,
 * path traversal, embedded scripts, and content sanity.
 */
export function scanFile(
  filePath: string,
  originalName: string,
  mimeType?: string,
): ScanResult {
  const checks: string[] = [];
  const ext = path.extname(originalName).toLowerCase();

  // 1. Extension whitelist
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return reject(`Blocked file extension: "${ext}". Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`, 0, ext, mimeType);
  }
  checks.push('extension_allowed');

  // 2. MIME type check (if provided by multer)
  if (mimeType && !ALLOWED_MIMES.has(mimeType)) {
    return reject(`Blocked MIME type: "${mimeType}"`, 0, ext, mimeType);
  }
  checks.push('mime_type_allowed');

  // 3. Filename sanitization — no path traversal
  if (/[\/\\]|\.\./.test(originalName)) {
    return reject('Filename contains path traversal characters', 0, ext, mimeType);
  }
  if (/[\x00-\x1f]/.test(originalName)) {
    return reject('Filename contains control characters', 0, ext, mimeType);
  }
  checks.push('filename_sanitized');

  // 4. File size
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return reject('File not found or unreadable', 0, ext, mimeType);
  }

  if (stat.size === 0) {
    return reject('File is empty', 0, ext, mimeType);
  }
  if (stat.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (stat.size / (1024 * 1024)).toFixed(1);
    const maxMB = (MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0);
    return reject(`File too large: ${sizeMB} MB (max ${maxMB} MB)`, stat.size, ext, mimeType);
  }
  checks.push('size_within_limit');

  // 5. Magic byte analysis
  const header = readHeader(filePath, 16);
  if (!header) {
    return reject('Could not read file header', stat.size, ext, mimeType);
  }

  // Check for dangerous file types
  for (const sig of DANGEROUS_SIGNATURES) {
    if (matchesBytes(header, sig.bytes)) {
      return reject(`File signature matches ${sig.name} — not a valid catalog file`, stat.size, ext, mimeType);
    }
  }
  checks.push('no_dangerous_signature');

  // 6. Extension-specific content validation
  if (ext === '.xlsx') {
    if (!matchesBytes(header, XLSX_MAGIC)) {
      return reject('File has .xlsx extension but is not a valid ZIP/XLSX container', stat.size, ext, mimeType);
    }
    checks.push('xlsx_magic_valid');
  }

  if (ext === '.json') {
    const jsonCheck = validateJsonContent(filePath, stat.size);
    if (!jsonCheck.valid) {
      return reject(jsonCheck.reason!, stat.size, ext, mimeType);
    }
    checks.push('json_content_valid');
  }

  if (ext === '.csv') {
    const csvCheck = validateCsvContent(filePath, stat.size);
    if (!csvCheck.valid) {
      return reject(csvCheck.reason!, stat.size, ext, mimeType);
    }
    checks.push('csv_content_valid');
  }

  // 7. Scan text-based files for embedded scripts/macros
  if (ext === '.json' || ext === '.csv') {
    const scriptCheck = scanForScripts(filePath, stat.size);
    if (!scriptCheck.safe) {
      return reject(scriptCheck.reason!, stat.size, ext, mimeType);
    }
    checks.push('no_embedded_scripts');
  }

  return {
    safe: true,
    file_size: stat.size,
    extension: ext,
    mime_type: mimeType,
    checks_passed: checks,
  };
}

// ── Helpers ──────────────────────────────────────────────────

function reject(reason: string, size: number, ext: string, mime?: string): ScanResult {
  return { safe: false, rejected_reason: reason, file_size: size, extension: ext, mime_type: mime, checks_passed: [] };
}

function readHeader(filePath: string, bytes: number): Buffer | null {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(bytes);
    fs.readSync(fd, buf, 0, bytes, 0);
    fs.closeSync(fd);
    return buf;
  } catch { return null; }
}

function matchesBytes(header: Buffer, sig: number[]): boolean {
  if (header.length < sig.length) return false;
  return sig.every((b, i) => header[i] === b);
}

function validateJsonContent(filePath: string, size: number): { valid: boolean; reason?: string } {
  try {
    // Read first 512 bytes to check structure
    const sample = fs.readFileSync(filePath, { encoding: 'utf-8', flag: 'r' }).substring(0, 512);
    const trimmed = sample.replace(/^\uFEFF/, '').trimStart(); // strip BOM + whitespace
    if (!trimmed.length || !JSON_VALID_STARTS.has(trimmed[0])) {
      return { valid: false, reason: 'JSON file does not start with valid JSON character ({, [, or ")' };
    }
    // For small files, attempt full parse
    if (size < 1024 * 1024) {
      JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    return { valid: true };
  } catch (e: any) {
    return { valid: false, reason: `Invalid JSON: ${e.message?.substring(0, 100)}` };
  }
}

function validateCsvContent(filePath: string, _size: number): { valid: boolean; reason?: string } {
  try {
    const sample = fs.readFileSync(filePath, { encoding: 'utf-8', flag: 'r' }).substring(0, 2048);
    const lines = sample.split('\n').filter(l => l.trim());
    if (lines.length < 2) {
      return { valid: false, reason: 'CSV has fewer than 2 lines (need header + at least one row)' };
    }
    // Check that lines have consistent delimiter usage
    const headerCommas = (lines[0].match(/,/g) || []).length;
    if (headerCommas === 0) {
      return { valid: false, reason: 'CSV header has no delimiters — may not be a valid CSV file' };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: 'Could not read CSV content' };
  }
}

function scanForScripts(filePath: string, size: number): { safe: boolean; reason?: string } {
  // Read up to 1MB for script scanning
  const readSize = Math.min(size, 1024 * 1024);
  try {
    const content = fs.readFileSync(filePath, { encoding: 'utf-8', flag: 'r' }).substring(0, readSize);
    const lower = content.toLowerCase();

    const patterns: { pattern: string; label: string }[] = [
      { pattern: '<script', label: 'HTML script tag' },
      { pattern: 'javascript:', label: 'JavaScript URI' },
      { pattern: 'vbscript:', label: 'VBScript URI' },
      { pattern: 'on(load|error|click|mouseover)=', label: 'HTML event handler' },
      { pattern: '<?php', label: 'PHP code' },
      { pattern: '<% ', label: 'Server-side template' },
      { pattern: 'eval\\(', label: 'eval() call' },
      { pattern: 'function\\(', label: 'JavaScript function definition' },
      { pattern: 'import\\(', label: 'Dynamic import' },
      { pattern: 'require\\(', label: 'Node.js require' },
      { pattern: '\\x00', label: 'Null byte' },
    ];

    for (const { pattern, label } of patterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(lower)) {
        return { safe: false, reason: `Embedded ${label} detected — file may contain malicious content` };
      }
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: 'Could not scan file content' };
  }
}
