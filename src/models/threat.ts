/** An ingested threat from an external feed or manual submission. */
export interface ThreatInput {
  id: string;
  channel:
    | 'stix_taxii' | 'cisa_kev' | 'nvd' | 'isac'
    | 'vendor_advisory' | 'manual' | 'osint' | 'internal';
  threat_type:
    | 'vulnerability' | 'exploit' | 'campaign' | 'malware'
    | 'ttp' | 'advisory' | 'regulatory' | 'best_practice';
  title: string;
  description?: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  cvss_score?: number;
  cve_id?: string;
  source_ref?: string;
  source_name?: string;
  affected_platforms?: string;  // JSON array
  affected_products?: string;   // JSON array
  ttps?: string;                // JSON array of ATT&CK technique IDs
  iocs?: string;                // JSON
  is_corroborated: boolean;
  corroborated_at?: string;
  corroborated_by?: string;
  ingested_at: string;
  processed: boolean;
  processed_at?: string;
  created_at: string;
}

export interface ThreatAssetCorrelation {
  threat_id: string;
  asset_id: string;
  match_type: 'platform' | 'product' | 'version' | 'manual' | 'cpe';
  match_detail?: string;
  correlated_at: string;
}
