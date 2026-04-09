import type { Severity } from './risk.js';

export type DriftAlertType =
  | 'policy_stale' | 'evidence_expired' | 'control_gap'
  | 'framework_update' | 'asset_drift' | 'risk_threshold'
  | 'training_overdue' | 'review_overdue' | 'connector_failure'
  | 'manual_intel_expiring' | 'disposition_expiring' | 'posture_change';

/** A detected misalignment across the entity graph. */
export interface DriftAlert {
  id: string;
  alert_type: DriftAlertType;
  severity: Severity;
  title: string;
  message?: string;
  source_entity_type: string;
  source_entity_id: string;
  affected_entities?: string; // JSON array of {type, id, name}
  detected_at: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  resolved_at?: string;
  resolved_by?: string;
  auto_resolved: boolean;
  resolution_note?: string;
  disposition_id?: string;
  suppressed_until?: string;
  created_at: string;
}

/** Input for creating a new drift alert (subset of full DriftAlert). */
export interface DriftAlertInput {
  alert_type: DriftAlertType;
  severity: Severity;
  title: string;
  message?: string;
  source_entity_type: string;
  source_entity_id: string;
  affected_entities?: string;
}
