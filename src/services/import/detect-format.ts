// ── Format Detection ─────────────────────────────────────────

export type ImportFormat =
  | 'sig-xlsx'
  | 'iso27001-xlsx'
  | 'oscal-json'
  | 'csv-generic'
  | 'unknown';

export interface DetectionResult {
  format: ImportFormat;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Detect file format from filename and (optionally) a content sample.
 * Content sample is the first ~2KB of the file as a string or Buffer.
 */
export function detectFormat(
  filename: string,
  contentSample?: string | Buffer,
): DetectionResult {
  const lower = filename.toLowerCase();
  const sample = contentSample?.toString('utf-8') ?? '';

  // SIG detection: xlsx with SIG-related naming
  if (lower.endsWith('.xlsx') && /sig[-_ ]?(full|lite|core|content)/i.test(lower)) {
    return { format: 'sig-xlsx', confidence: 'high', reason: 'Filename matches SIG pattern' };
  }

  // ISO 27001 detection: xlsx with ISO-related naming
  if (lower.endsWith('.xlsx') && /iso[-_ ]?27001|annex[-_ ]?a/i.test(lower)) {
    return { format: 'iso27001-xlsx', confidence: 'high', reason: 'Filename matches ISO 27001 pattern' };
  }

  // OSCAL JSON detection
  if (lower.endsWith('.json')) {
    if (sample.includes('"catalog"') || sample.includes('"oscal-version"')) {
      return { format: 'oscal-json', confidence: 'high', reason: 'JSON contains OSCAL catalog markers' };
    }
    return { format: 'oscal-json', confidence: 'medium', reason: 'JSON file, assuming OSCAL' };
  }

  // CSV detection
  if (lower.endsWith('.csv')) {
    return { format: 'csv-generic', confidence: 'high', reason: 'CSV file detected' };
  }

  // Ambiguous xlsx — prompt for format
  if (lower.endsWith('.xlsx')) {
    return { format: 'unknown', confidence: 'low', reason: 'XLSX file — specify format with --format flag' };
  }

  return { format: 'unknown', confidence: 'low', reason: 'Unrecognized file type' };
}
