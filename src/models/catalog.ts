/**
 * Represents a control catalog (e.g. NIST 800-171, ISO 27001, SIG Lite).
 * Matches the `catalogs` table in the database schema.
 */
export interface Catalog {
  id: string;
  name: string;
  short_name: string;
  version?: string;
  source_url?: string;
  source_format?: string;
  total_controls: number;
  description?: string;
  publisher?: string;
  oscal_uuid?: string;
  created_at: string;
  updated_at: string;
}
