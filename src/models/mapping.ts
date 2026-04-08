/**
 * Represents a cross-framework mapping between two controls.
 * Matches the `control_mappings` table in the database schema.
 */
export interface ControlMapping {
  id: string;
  source_control_id: string;
  target_control_id: string;
  relationship: 'equivalent' | 'subset' | 'superset' | 'related' | 'intersects';
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
  source: 'manual' | 'sig-content-library' | 'nist-published' | 'ai-suggested';
  verified_by?: string;
  verified_at?: string;
  created_at: string;
}
