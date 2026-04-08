/**
 * Represents a piece of evidence linked to an implementation or assessment result.
 * Matches the `evidence` table in the database schema.
 */
export interface Evidence {
  id: string;
  implementation_id?: string;
  assessment_result_id?: string;
  title: string;
  description?: string;
  evidence_type:
    | 'document'
    | 'screenshot'
    | 'log'
    | 'policy'
    | 'interview'
    | 'observation';
  file_path?: string;
  file_hash?: string;
  url?: string;
  collected_at?: string;
  collected_by?: string;
  created_at: string;
}

/**
 * Represents a Plan of Action & Milestones (POA&M) item for tracking remediation.
 * Matches the `poam_items` table in the database schema.
 */
export interface PoamItem {
  id: string;
  org_id: string;
  assessment_result_id?: string;
  control_id: string;
  poam_id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  finding: string;
  current_state?: string;
  required_action: string;
  responsible?: string;
  support?: string;
  target_date?: string;
  actual_completion_date?: string;
  status:
    | 'not-started'
    | 'in-progress'
    | 'completed'
    | 'overdue'
    | 'deferred';
  notes?: string;
  created_at: string;
  updated_at: string;
}
