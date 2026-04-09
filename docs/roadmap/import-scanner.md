# 6A · File Scanner + Format Autodetection

**Status:** 🔧 In Progress

## Scope

Security scanner that validates every uploaded file before parsing. Format autodetection from filename patterns and content inspection.

## File

`src/services/import/file-scanner.ts` + `src/services/import/detect-format.ts`

## Scanner Checks (in order)

1. Extension whitelist (`.xlsx`, `.json`, `.csv` only)
2. MIME type validation
3. Filename sanitization (no path traversal, no control chars)
4. File size (10 MB hard cap)
5. Magic byte analysis (rejects executables, archives, shell scripts)
6. XLSX container validation (PK zip magic)
7. JSON structure validation (valid start char, full parse under 1 MB)
8. CSV structure validation (header + data row + delimiters)
9. Embedded script detection (`<script>`, `eval(`, `<?php`, event handlers, null bytes)

## Format Detection

- SIG: `.xlsx` + filename matches `/sig[-_ ]?(full|lite|core|content)/i`
- ISO 27001: `.xlsx` + filename matches `/iso[-_ ]?27001|annex[-_ ]?a/i`
- OSCAL: `.json` + content contains `"catalog"` or `"oscal-version"`
- CSV: `.csv` extension
- Unknown: ambiguous `.xlsx` without matching filename → user must specify `--format`

## Exit Criteria

- [ ] Malicious files rejected with descriptive reason
- [ ] Valid files pass all checks and return check list
- [ ] Format detection works for all 4 supported types
