import type { DispositionType } from '../../models/disposition.js';

interface Classification {
  type: DispositionType;
  confidence: number;
  match: string | null;
  ambiguous: boolean;
  alternatives: Array<{ type: string; score: number }>;
}

const PATTERNS: Record<DispositionType, RegExp[]> = {
  accepted_risk: [
    /accept(?:ed|ing)?\s+(?:the\s+)?risk/i,
    /risk\s+(?:is\s+)?accept(?:ed|able)/i,
    /we(?:'ve|'re|\s+have|\s+are)\s+(?:ok|okay|fine)\s+with/i,
    /known\s+risk/i,
  ],
  by_design: [
    /by\s+design/i,
    /that(?:'s|\s+is)\s+(?:intentional|deliberate|on\s+purpose)/i,
    /(?:designed|written|configured)\s+that\s+way/i,
    /(?:we|they|sara|tony)\s+(?:agreed|decided|chose)/i,
  ],
  compensating_control: [
    /compensating\s+control/i,
    /(?:covered|handled|addressed)\s+by/i,
    /alternative\s+(?:control|measure|mitigation)/i,
  ],
  deferred: [
    /defer(?:red|ring)?/i,
    /(?:scheduled|planned|slated)\s+for/i,
    /(?:fix|address|remediate)(?:ing)?\s+(?:this|that|it)\s+(?:in|by|next)/i,
    /(?:on\s+the\s+)?roadmap/i,
    /(?:q[1-4]|next\s+(?:quarter|month|sprint))/i,
    /known\s+issue/i,
  ],
  false_positive: [
    /false\s+positive/i,
    /system\s+(?:misread|got\s+(?:it\s+)?wrong|is\s+wrong)/i,
    /not\s+(?:actually|really)\s+(?:a\s+)?(?:gap|issue|problem)/i,
    /misidentified/i,
  ],
  not_applicable: [
    /not\s+applicable/i,
    /n\/?a/i,
    /doesn(?:'t|\s+not)\s+apply/i,
    /(?:out\s+of|outside)\s+(?:our\s+)?scope/i,
    /don(?:'t|\s+not)\s+(?:have|use|run|operate)/i,
  ],
};

/**
 * Classifies analyst free-text into a disposition type
 * using weighted pattern matching.
 */
export function classifyDisposition(text: string): Classification {
  const scores: Array<{ type: DispositionType; score: number; match: string | null }> = [];

  for (const [type, patterns] of Object.entries(PATTERNS) as Array<[DispositionType, RegExp[]]>) {
    let matchCount = 0;
    let strongest: string | null = null;

    for (const pattern of patterns) {
      const m = text.match(pattern);
      if (m) {
        matchCount++;
        if (!strongest || m[0].length > strongest.length) strongest = m[0];
      }
    }

    if (matchCount > 0) {
      scores.push({ type, score: matchCount / patterns.length, match: strongest });
    }
  }

  scores.sort((a, b) => b.score - a.score);

  if (scores.length === 0) {
    return { type: 'deferred', confidence: 0.3, match: null, ambiguous: true, alternatives: [] };
  }

  const best = scores[0];
  const ambiguous = scores.length > 1 && (best.score - scores[1].score) < 0.2;

  return {
    type: best.type,
    confidence: ambiguous ? best.score * 0.7 : best.score,
    match: best.match,
    ambiguous,
    alternatives: ambiguous
      ? scores.slice(1, 3).map(s => ({ type: s.type, score: s.score }))
      : [],
  };
}
