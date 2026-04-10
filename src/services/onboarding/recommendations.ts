/**
 * Framework recommendation engine.
 * Suggests catalogs based on industry + org size.
 */

export interface CatalogRecommendation {
  shortName: string;
  name: string;
  controlCount: number;
  recommended: boolean;
  reason?: string;
}

const CATALOG_META: Record<string, { name: string; controls: number }> = {
  'nist-800-171-r3':      { name: 'NIST SP 800-171 Rev 3', controls: 110 },
  'cmmc-2.0':             { name: 'CMMC 2.0 Level 2', controls: 110 },
  'nispom-117':           { name: 'NISPOM 32 CFR 117', controls: 72 },
  'nist-800-53-r5':       { name: 'NIST SP 800-53 Rev 5', controls: 1189 },
  'nist-csf-2.0':         { name: 'NIST CSF 2.0', controls: 106 },
  'soc2-tsc':             { name: 'SOC 2 TSC', controls: 64 },
  'pci-dss-4':            { name: 'PCI DSS 4.0', controls: 78 },
  'hipaa-security':       { name: 'HIPAA Security Rule', controls: 54 },
  'gdpr':                 { name: 'GDPR', controls: 99 },
  'eu-ai-act':            { name: 'EU AI Act', controls: 45 },
  'ccpa-cpra':            { name: 'CCPA/CPRA', controls: 35 },
  'nist-800-218':         { name: 'NIST SP 800-218 (SSDF)', controls: 43 },
};

const INDUSTRY_RECS: Record<string, string[]> = {
  defense:    ['nist-800-171-r3', 'cmmc-2.0', 'nispom-117'],
  finance:    ['soc2-tsc', 'pci-dss-4', 'nist-csf-2.0'],
  healthcare: ['hipaa-security', 'soc2-tsc', 'nist-csf-2.0'],
  technology: ['soc2-tsc', 'nist-csf-2.0'],
  government: ['nist-800-53-r5', 'nist-csf-2.0'],
  other:      ['nist-csf-2.0'],
};

const SIZE_EXTRAS: Record<string, string[]> = {
  medium:     ['nist-800-218'],
  large:      ['nist-800-218', 'nist-800-53-r5'],
  enterprise: ['nist-800-218', 'nist-800-53-r5'],
};

/**
 * Generate catalog recommendations for an organization.
 */
export function getRecommendations(
  industry: string,
  size: string,
): CatalogRecommendation[] {
  const recommended = new Set<string>(
    INDUSTRY_RECS[industry.toLowerCase()] ?? INDUSTRY_RECS.other!
  );

  // Add size-based extras
  for (const extra of SIZE_EXTRAS[size.toLowerCase()] ?? []) {
    recommended.add(extra);
  }

  // Technology + medium+ gets ISO 27001 note
  if (industry.toLowerCase() === 'technology' && size !== 'small') {
    // ISO 27001 is proprietary — we note it but can't bundle it
  }

  return Object.entries(CATALOG_META).map(([shortName, meta]) => ({
    shortName,
    name: meta.name,
    controlCount: meta.controls,
    recommended: recommended.has(shortName),
    reason: recommended.has(shortName)
      ? `Recommended for ${industry} organizations`
      : undefined,
  }));
}

/** Get available industries. */
export const INDUSTRIES = ['defense', 'finance', 'healthcare', 'technology', 'government', 'other'];

/** Get available org sizes. */
export const ORG_SIZES = ['small', 'medium', 'large', 'enterprise'];
