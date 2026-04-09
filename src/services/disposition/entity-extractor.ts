export interface ExtractedEntity {
  type: string;
  value: string;
  full_match: string;
  position: number;
}

const PATTERNS: Record<string, RegExp> = {
  mcat_item:       /(?:mcat|m-cat)\s*(?:item|question|#)?\s*(\d{1,2}[\.\-]\d{3})/gi,
  nist_control:    /(?:nist\s+)?(?:800-(?:53|171)\s+)?([A-Z]{2}-\d{1,2}(?:\(\d+\))?)/g,
  cmmc_practice:   /(?:cmmc\s+)?([A-Z]{2}\.L[1-3]-\d\.\d{1,2}\.\d{1,2})/gi,
  nispom_section:  /(?:nispom\s+)?(?:32\s*cfr\s+)?117\.(\d{1,2}(?:\.\d+)*(?:\([a-z]\))?)/gi,
  policy_section:  /(?:section|sec\.?|§)\s*(\d+(?:\.\d+)*)/gi,
  jira_ticket:     /([A-Z]{2,10}-\d{1,6})/g,
};

/**
 * Extracts structured entity references from analyst free-text.
 * Deduplicates by type + value.
 */
export function extractEntities(text: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  for (const [entityType, pattern] of Object.entries(PATTERNS)) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      entities.push({
        type: entityType,
        value: match[1] ?? match[0],
        full_match: match[0],
        position: match.index,
      });
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return entities.filter(e => {
    const key = `${e.type}:${e.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Extracts a temporal reference (quarter, relative date) for deferrals.
 */
export function extractTemporalRef(text: string): {
  type: string;
  raw: string;
  resolved_date: string;
} | null {
  const now = new Date();

  const quarterMatch = text.match(/q([1-4])\s*(?:(\d{4}))?/i);
  if (quarterMatch) {
    const q = parseInt(quarterMatch[1]);
    const year = quarterMatch[2] ? parseInt(quarterMatch[2]) : now.getFullYear();
    const endMonth = q * 3; // end-of-quarter month (1-indexed)
    const target = new Date(year, endMonth, 0); // last day of that month
    return { type: 'quarter', raw: quarterMatch[0], resolved_date: target.toISOString().split('T')[0] };
  }

  const relativeMatch = text.match(/next\s+(quarter|month|week|sprint)/i);
  if (relativeMatch) {
    const offsets: Record<string, number> = { week: 7, sprint: 14, month: 30, quarter: 90 };
    const target = new Date(now);
    target.setDate(target.getDate() + (offsets[relativeMatch[1].toLowerCase()] ?? 30));
    return { type: 'relative', raw: relativeMatch[0], resolved_date: target.toISOString().split('T')[0] };
  }

  return null;
}
