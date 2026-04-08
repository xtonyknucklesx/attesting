import Database from 'better-sqlite3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChangeType = 'added' | 'removed' | 'modified' | 'renumbered' | 'unchanged';
export type ModificationSeverity = 'minor' | 'moderate' | 'major';
export type ActionNeeded = 'no-action' | 'review-implementation' | 'new-implementation-required';

export interface ControlSnapshot {
  id: string;           // internal UUID
  control_id: string;   // framework-native ID
  title: string;
  description: string;
  guidance: string;
}

export interface WordDiff {
  added: string[];
  removed: string[];
  shared: string[];
  similarity: number;   // 0–1
}

export interface ControlChange {
  changeType: ChangeType;
  oldControl: ControlSnapshot | null;
  newControl: ControlSnapshot | null;
  /** For RENUMBERED: the old control_id. */
  renumberedFrom?: string;
  /** Word-level diff of description for MODIFIED controls. */
  descriptionDiff?: WordDiff;
  /** Word-level diff of title for MODIFIED controls. */
  titleDiff?: WordDiff;
  /** minor (<20% changed), moderate (20-50%), major (>50%) */
  severity?: ModificationSeverity;
  /** Does the org have an implementation for the old control? */
  hasExistingImpl: boolean;
  /** What action is needed? */
  actionNeeded: ActionNeeded;
  /** Control IDs from other frameworks that are linked. */
  affectedMappings: string[];
}

export interface DiffResult {
  oldCatalogShortName: string;
  newCatalogShortName: string;
  added: ControlChange[];
  removed: ControlChange[];
  modified: ControlChange[];
  renumbered: ControlChange[];
  unchanged: ControlChange[];
  summary: {
    total: number;
    added: number;
    removed: number;
    modified: number;
    renumbered: number;
    unchanged: number;
  };
}

// ---------------------------------------------------------------------------
// Text comparison utilities
// ---------------------------------------------------------------------------

/** Tokenize text into lowercase words, stripping punctuation. */
function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/**
 * Compute word-level diff between two texts.
 * Returns shared/added/removed word lists and a similarity score (0–1).
 */
export function wordDiff(oldText: string, newText: string): WordDiff {
  const oldWords = tokenize(oldText);
  const newWords = tokenize(newText);

  const oldSet = new Set(oldWords);
  const newSet = new Set(newWords);

  const shared = oldWords.filter((w) => newSet.has(w));
  const removed = oldWords.filter((w) => !newSet.has(w));
  const added = newWords.filter((w) => !oldSet.has(w));

  const unionSize = new Set([...oldWords, ...newWords]).size;
  const similarity = unionSize === 0 ? 1 : shared.length / unionSize;

  return {
    added: [...new Set(added)],
    removed: [...new Set(removed)],
    shared: [...new Set(shared)],
    similarity,
  };
}

/**
 * Compute word overlap similarity between two texts (0–1).
 * Used for renumber detection — compares bag-of-words overlap.
 */
export function textSimilarity(a: string, b: string): number {
  const wordsA = tokenize(a);
  const wordsB = tokenize(b);
  if (wordsA.length === 0 && wordsB.length === 0) return 1;
  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  let overlap = 0;
  for (const w of setA) {
    if (setB.has(w)) overlap++;
  }
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : overlap / union;
}

function classifySeverity(similarity: number): ModificationSeverity {
  if (similarity >= 0.8) return 'minor';
  if (similarity >= 0.5) return 'moderate';
  return 'major';
}

// ---------------------------------------------------------------------------
// Main diff function
// ---------------------------------------------------------------------------

/**
 * Compare two catalog versions and produce a structured change report.
 *
 * @param oldShortName  Short name of the old catalog version.
 * @param newShortName  Short name of the new catalog version.
 * @param db            Open better-sqlite3 database.
 * @param orgId         Optional org ID for implementation impact analysis.
 * @param scopeId       Optional scope ID for scoped impact analysis.
 */
export function diffCatalogs(
  oldShortName: string,
  newShortName: string,
  db: Database.Database,
  orgId?: string,
  scopeId?: string
): DiffResult {
  // Load controls from both catalogs
  const loadControls = (shortName: string): ControlSnapshot[] => {
    return db
      .prepare(
        `SELECT c.id, c.control_id, c.title, COALESCE(c.description, '') AS description,
                COALESCE(c.guidance, '') AS guidance
         FROM controls c
         JOIN catalogs cat ON c.catalog_id = cat.id
         WHERE cat.short_name = ?
         ORDER BY c.sort_order, c.control_id`
      )
      .all(shortName) as ControlSnapshot[];
  };

  const oldControls = loadControls(oldShortName);
  const newControls = loadControls(newShortName);

  // Build lookup maps by control_id
  const oldByNativeId = new Map(oldControls.map((c) => [c.control_id, c]));
  const newByNativeId = new Map(newControls.map((c) => [c.control_id, c]));

  // Prepare implementation lookup (if org provided)
  const hasImpl = (controlUuid: string): boolean => {
    if (!orgId) return false;
    const scopeFilter = scopeId ? 'AND (scope_id = ? OR scope_id IS NULL)' : '';
    const params: unknown[] = [controlUuid, orgId];
    if (scopeId) params.push(scopeId);
    const row = db
      .prepare(
        `SELECT 1 FROM implementations
         WHERE primary_control_id = ? AND org_id = ?
         AND status IN ('implemented', 'partially-implemented', 'planned', 'alternative')
         ${scopeFilter} LIMIT 1`
      )
      .get(...params) as unknown;
    return !!row;
  };

  // Prepare mapping lookup
  const getMappedControlIds = (controlUuid: string): string[] => {
    const rows = db
      .prepare(
        `SELECT cat.short_name || ':' || c.control_id AS ref
         FROM control_mappings cm
         JOIN controls c ON (cm.target_control_id = c.id OR cm.source_control_id = c.id)
         JOIN catalogs cat ON c.catalog_id = cat.id
         WHERE (cm.source_control_id = ? OR cm.target_control_id = ?)
           AND c.id != ?`
      )
      .all(controlUuid, controlUuid, controlUuid) as { ref: string }[];
    return rows.map((r) => r.ref);
  };

  // Classify controls
  const added: ControlChange[] = [];
  const removed: ControlChange[] = [];
  const modified: ControlChange[] = [];
  const unchanged: ControlChange[] = [];
  const renumbered: ControlChange[] = [];

  // Track which old controls have been matched
  const matchedOldIds = new Set<string>();

  // Pass 1: Match by control_id
  for (const newCtrl of newControls) {
    const oldCtrl = oldByNativeId.get(newCtrl.control_id);
    if (oldCtrl) {
      matchedOldIds.add(oldCtrl.control_id);

      // Compare content
      const titleSame = oldCtrl.title === newCtrl.title;
      const descSame = oldCtrl.description === newCtrl.description;

      if (titleSame && descSame) {
        unchanged.push({
          changeType: 'unchanged',
          oldControl: oldCtrl,
          newControl: newCtrl,
          hasExistingImpl: hasImpl(oldCtrl.id),
          actionNeeded: 'no-action',
          affectedMappings: [],
        });
      } else {
        const descDiff = wordDiff(oldCtrl.description, newCtrl.description);
        const tDiff = wordDiff(oldCtrl.title, newCtrl.title);
        const combinedSim = (descDiff.similarity + tDiff.similarity) / 2;
        const severity = classifySeverity(combinedSim);
        const existingImpl = hasImpl(oldCtrl.id);

        modified.push({
          changeType: 'modified',
          oldControl: oldCtrl,
          newControl: newCtrl,
          descriptionDiff: descDiff,
          titleDiff: tDiff,
          severity,
          hasExistingImpl: existingImpl,
          actionNeeded: existingImpl ? 'review-implementation' : 'no-action',
          affectedMappings: getMappedControlIds(oldCtrl.id),
        });
      }
    }
  }

  // Collect unmatched controls from both sides
  const unmatchedOld = oldControls.filter((c) => !matchedOldIds.has(c.control_id));
  const unmatchedNew = newControls.filter((c) => !oldByNativeId.has(c.control_id));

  // Pass 2: Detect renumbered controls among unmatched
  // For each unmatched new control, check if any unmatched old control
  // has >85% description similarity
  const RENUMBER_THRESHOLD = 0.85;
  const renumberedOldIds = new Set<string>();
  const renumberedNewIds = new Set<string>();

  for (const newCtrl of unmatchedNew) {
    if (renumberedNewIds.has(newCtrl.control_id)) continue;

    let bestMatch: ControlSnapshot | null = null;
    let bestSim = 0;

    for (const oldCtrl of unmatchedOld) {
      if (renumberedOldIds.has(oldCtrl.control_id)) continue;
      const descText = (oldCtrl.description || '') + ' ' + (oldCtrl.title || '');
      const newText = (newCtrl.description || '') + ' ' + (newCtrl.title || '');
      const sim = textSimilarity(descText, newText);
      if (sim > bestSim) {
        bestSim = sim;
        bestMatch = oldCtrl;
      }
    }

    if (bestMatch && bestSim >= RENUMBER_THRESHOLD) {
      renumberedOldIds.add(bestMatch.control_id);
      renumberedNewIds.add(newCtrl.control_id);
      const existingImpl = hasImpl(bestMatch.id);

      renumbered.push({
        changeType: 'renumbered',
        oldControl: bestMatch,
        newControl: newCtrl,
        renumberedFrom: bestMatch.control_id,
        hasExistingImpl: existingImpl,
        actionNeeded: existingImpl ? 'review-implementation' : 'no-action',
        affectedMappings: getMappedControlIds(bestMatch.id),
      });
    }
  }

  // Pass 3: Remaining unmatched = truly added/removed
  for (const newCtrl of unmatchedNew) {
    if (renumberedNewIds.has(newCtrl.control_id)) continue;
    added.push({
      changeType: 'added',
      oldControl: null,
      newControl: newCtrl,
      hasExistingImpl: false,
      actionNeeded: 'new-implementation-required',
      affectedMappings: [],
    });
  }

  for (const oldCtrl of unmatchedOld) {
    if (renumberedOldIds.has(oldCtrl.control_id)) continue;
    removed.push({
      changeType: 'removed',
      oldControl: oldCtrl,
      newControl: null,
      hasExistingImpl: hasImpl(oldCtrl.id),
      actionNeeded: 'no-action',
      affectedMappings: getMappedControlIds(oldCtrl.id),
    });
  }

  const total = added.length + removed.length + modified.length + renumbered.length + unchanged.length;

  return {
    oldCatalogShortName: oldShortName,
    newCatalogShortName: newShortName,
    added,
    removed,
    modified,
    renumbered,
    unchanged,
    summary: {
      total,
      added: added.length,
      removed: removed.length,
      modified: modified.length,
      renumbered: renumbered.length,
      unchanged: unchanged.length,
    },
  };
}
