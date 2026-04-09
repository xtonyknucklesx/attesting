import type { Severity } from './risk.js';

/** Unverified human-submitted intelligence in provisional state. */
export interface ManualIntel {
  id: string;
  title: string;
  description: string;
  source_description?: string;
  submitted_by?: string;
  confidence_level: 'unverified' | 'low' | 'medium' | 'high' | 'confirmed';
  intel_type: 'threat' | 'vulnerability' | 'regulatory' | 'operational' | 'best_practice';
  severity_estimate: Severity;
  affected_platforms_est?: string;   // JSON array
  affected_controls_est?: string;    // JSON array
  shadow_impact_snapshot?: string;   // JSON
  shadow_generated_at?: string;
  corroboration_deadline?: string;
  corroboration_sources?: string;    // JSON array
  promoted_to_threat_id?: string;
  promoted_at?: string;
  archived_at?: string;
  archive_reason?: string;
  status: 'provisional' | 'watching' | 'promoted' | 'archived';
  created_at: string;
  updated_at: string;
}

/** Result of a shadow (dry-run) propagation for provisional intel. */
export interface ShadowImpactResult {
  summary: string;
  assets_at_risk: Array<{ id: string; name: string; platform?: string }>;
  controls_to_review: Array<{
    control_id: string;
    implementation_id: string;
    current_status: string;
    owner?: string;
  }>;
  risk_score_deltas: Array<{
    risk_id: string;
    risk_title: string;
    current_residual: number | null;
    projected_residual: number;
    delta: number;
  }>;
  frameworks_affected: string[];
  alerts_would_fire: number;
}
