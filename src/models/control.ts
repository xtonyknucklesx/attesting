/**
 * Represents a single control within a catalog.
 * Matches the `controls` table in the database schema.
 * SIG-specific fields are optional for non-SIG catalogs.
 */
export interface Control {
  id: string;
  catalog_id: string;
  control_id: string;
  parent_control_id?: string;
  title: string;
  description?: string;
  guidance?: string;
  metadata: string; // JSON blob
  // SIG-specific fields
  sig_risk_domain?: string;
  sig_control_family?: string;
  sig_control_attribute?: string;
  sig_scope_level?: string;
  sig_serial_no?: number;
  sig_importance?: string;
  sig_doc_reference?: string;
  sort_order: number;
  created_at: string;
}
