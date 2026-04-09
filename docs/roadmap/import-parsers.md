# 6B · SIG Full / ISO 27001 Parsers

**Status:** 🔧 In Progress
**File:** `src/services/import/parsers.ts`
**Scope:** Format-specific parsers for SIG (xlsx), ISO 27001 (xlsx), OSCAL (json), CSV (generic). Each returns `ParsedCatalog` with controls, catalog name, warnings. SIG parser auto-detects Full vs Lite by control count. ISO parser looks for Annex A column patterns. All parsers use flexible column header matching to handle vendor variations.
**Exit:** Each parser extracts controls from sample files without errors.
