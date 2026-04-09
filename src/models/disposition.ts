export type DispositionType =
  | 'accepted_risk' | 'by_design' | 'compensating_control'
  | 'deferred' | 'false_positive' | 'not_applicable';

export type ApprovalStatus =
  | 'pending' | 'approved' | 'rejected' | 'escalated' | 'expired';

/** An analyst's structured judgment about a drift alert. */
export interface Disposition {
  id: string;
  drift_alert_id: string;
  disposition_type: DispositionType;
  analyst_id: string;
  rationale: string;
  rationale_parsed?: string;
  linked_entities?: string;
  compensating_impl_id?: string;
  deferral_target_date?: string;
  requires_approval: boolean;
  approval_status: ApprovalStatus;
  supervisor_id?: string;
  supervisor_note?: string;
  approved_at?: string;
  expires_at?: string;
  auto_tasks_created?: string;
  nlp_confidence?: number;
  created_at: string;
  updated_at: string;
}

/** A follow-up task auto-generated from a disposition. */
export interface DispositionTask {
  id: string;
  disposition_id: string;
  title: string;
  description?: string;
  assigned_to?: string;
  target_entity_type?: string;
  target_entity_id?: string;
  due_date?: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  completed_at?: string;
  external_ticket_id?: string;
  external_ticket_url?: string;
  created_at: string;
  updated_at: string;
}

/** Disposition types that require supervisor sign-off. */
export const REQUIRES_SUPERVISOR = new Set<DispositionType>([
  'accepted_risk', 'by_design', 'compensating_control', 'not_applicable',
]);

/** Default TTL in days by disposition type. */
export const DISPOSITION_TTL_DAYS: Record<DispositionType, number> = {
  accepted_risk: 180,
  by_design: 365,
  compensating_control: 180,
  deferred: 90,
  false_positive: 365,
  not_applicable: 365,
};
