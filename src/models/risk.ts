/**
 * Matches the existing `risks` table in schema.sql
 * plus extension columns from migration 002.
 */
export interface Risk {
  id: string;
  risk_id: string;          // human-readable: "RISK-001"
  title: string;
  description?: string;
  category?: string;
  source?: string;
  likelihood: number;
  impact: number;
  inherent_risk_score?: number;
  residual_likelihood?: number;
  residual_impact?: number;
  residual_risk_score?: number;
  treatment: string;
  treatment_plan?: string;
  owner: string;            // existing free-text owner
  status: string;
  review_date?: string;
  // v2 extensions
  owner_id?: string;        // FK to owners table
  source_type?: string;     // 'threat_input', 'control_gap', etc.
  source_id?: string;       // FK to originating entity
  created_at: string;
  updated_at: string;
}

/** Existing risk_controls junction table. */
export interface RiskControlLink {
  id: string;
  risk_id: string;
  control_id: string;
  effectiveness: string;
  notes?: string;
}

/** Existing risk_exceptions table. */
export interface RiskException {
  id: string;
  risk_id: string;
  control_id?: string;
  justification: string;
  compensating_controls?: string;
  approved_by: string;
  approved_date: string;
  expiry_date: string;
  status: string;
  created_at: string;
}

/** New: risk ↔ asset junction from migration 002. */
export interface RiskAssetLink {
  risk_id: string;
  asset_id: string;
}

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export const SEVERITY_TO_LIKELIHOOD: Record<Severity, number> = {
  info: 1, low: 2, medium: 3, high: 4, critical: 5,
};
