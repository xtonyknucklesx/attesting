# 6E · Import Web UI

**Status:** 🔧 In Progress
**File:** `src/web/client/components/ImportProprietary.tsx`
**Scope:** React component with 4-step flow: upload (drag-drop + format selector) → preview (controls table + mappings table + scan results + overwrite checkbox) → importing (spinner) → done (result summary). Shows security scan pass count and file size. Handles error states with descriptive messages.
**Key:** File types restricted to `.xlsx,.json,.csv`. Shows "10 MB max" in UI. Scan results displayed in preview. Overwrite confirmation required for existing catalogs.
**Exit:** Full upload → preview → confirm flow works in browser. Rejected files show scan reason.
