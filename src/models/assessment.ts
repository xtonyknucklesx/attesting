/**
 * Represents a point-in-time assessment of controls.
 * Matches the `assessments` table in the database schema.
 */
export interface Assessment {
  id: string;
  org_id: string;
  scope_id?: string;
  catalog_id: string;
  name: string;
  assessment_type: 'self' | 'third-party' | 'audit' | 'dcsa-review';
  assessor?: string;
  started_at?: string;
  completed_at?: string;
  status: 'planned' | 'in-progress' | 'completed' | 'archived';
  total_controls: number;
  controls_met: number;
  controls_not_met: number;
  controls_na: number;
  controls_partial: number;
  notes?: string;
  created_at: string;
}

/**
 * Represents the assessment result for a single control.
 * Matches the `assessment_results` table in the database schema.
 */
export interface AssessmentResult {
  id: string;
  assessment_id: string;
  control_id: string;
  implementation_id?: string;
  result:
    | 'satisfied'
    | 'not-satisfied'
    | 'partial'
    | 'not-applicable'
    | 'not-assessed';
  finding?: string;
  risk_level?: 'critical' | 'high' | 'medium' | 'low';
  assessor_notes?: string;
  assessed_at: string;
}
