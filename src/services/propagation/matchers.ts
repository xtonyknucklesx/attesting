/**
 * Fuzzy-matches an asset platform string against a list of threat
 * platform patterns. Supports wildcard versions like "linux-kernel-6.x".
 */
export function platformMatches(
  assetPlatform: string | null | undefined,
  threatPlatforms: string[],
): boolean {
  if (!assetPlatform || threatPlatforms.length === 0) return false;

  const normalized = assetPlatform.toLowerCase();
  return threatPlatforms.some(tp => {
    const pattern = tp.toLowerCase();
    if (pattern.includes('.x')) {
      const prefix = pattern.replace('.x', '');
      return normalized.startsWith(prefix);
    }
    return normalized.includes(pattern) || pattern.includes(normalized);
  });
}

/**
 * Maps MITRE ATT&CK technique IDs to NIST 800-53 control families.
 * Simplified mapping — production would traverse the full
 * ATT&CK → D3FEND → 800-53 chain.
 */
const TTP_TO_CONTROLS: Record<string, string[]> = {
  'T1190': ['SI-2', 'SI-5', 'RA-5'],
  'T1133': ['AC-17', 'IA-2', 'IA-8'],
  'T1078': ['AC-2', 'AC-6', 'IA-5'],
  'T1566': ['AT-2', 'SI-8', 'SC-7'],
  'T1053': ['CM-7', 'AC-3', 'AU-2'],
  'T1059': ['CM-7', 'SI-3', 'SI-7'],
  'T1027': ['SI-3', 'SI-4'],
  'T1071': ['SC-7', 'SI-4', 'CA-7'],
  'T1486': ['CP-9', 'CP-10', 'SI-3'],
  'T1110': ['AC-7', 'IA-5', 'SI-4'],
  'T1046': ['CM-7', 'SC-7', 'SI-4'],
  'T1070': ['AU-9', 'AU-6', 'SI-4'],
  'T1105': ['CM-7', 'SC-7', 'SI-3'],
  'T1021': ['AC-17', 'CM-7', 'IA-2'],
  'T1048': ['SC-7', 'SI-4', 'AC-4'],
};

export function mapTTPsToControls(ttps: string[]): string[] {
  const controls = new Set<string>();
  for (const ttp of ttps) {
    const mapped = TTP_TO_CONTROLS[ttp];
    if (mapped) mapped.forEach(c => controls.add(c));
  }
  return [...controls];
}

/**
 * Jaccard keyword overlap between two strings.
 * Used for fuzzy matching manual intel titles against threat feed titles.
 */
export function keywordOverlap(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  const tokenize = (t: string) =>
    new Set(t.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  const a = tokenize(text1);
  const b = tokenize(text2);
  const intersection = [...a].filter(w => b.has(w));
  const union = new Set([...a, ...b]);
  return union.size > 0 ? intersection.length / union.size : 0;
}
