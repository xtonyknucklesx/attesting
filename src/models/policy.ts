/**
 * Matches the existing `policies` table in schema.sql
 * plus extension columns from migration 002.
 */
export interface Policy {
  id: string;
  title: string;
  description?: string;
  policy_type: string;
  status: string;
  version?: string;
  owner?: string;
  approver?: string;
  approved_date?: string;
  effective_date?: string;
  review_date?: string;
  expiry_date?: string;
  review_frequency_days: number;
  document_path?: string;
  // v2 extensions
  content_hash?: string;
  short_name?: string;
  owner_id?: string;
  supersedes_id?: string;
  next_review_date?: string;
  created_at: string;
  updated_at: string;
}

export interface PolicyControlLink {
  id: string;
  policy_id: string;
  control_id: string;
  notes?: string;
}

/**
 * Granular section within a policy for per-section drift tracking.
 * New in migration 002.
 */
export interface PolicySection {
  id: string;
  policy_id: string;
  section_number: string;
  title: string;
  content_hash: string;
  version: string;
  summary?: string;
  created_at: string;
  updated_at: string;
}
