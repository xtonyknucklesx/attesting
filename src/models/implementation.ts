/**
 * Represents an implementation statement that describes how an organization
 * satisfies a control. Matches the `implementations` table.
 */
export interface Implementation {
  id: string;
  org_id: string;
  scope_id?: string;
  primary_control_id: string;
  status:
    | 'implemented'
    | 'partially-implemented'
    | 'planned'
    | 'alternative'
    | 'not-applicable'
    | 'not-implemented';
  statement: string;
  responsible_role?: string;
  responsible_person?: string;
  sig_response?: string;
  sig_additional_info?: string;
  sig_scoring?: string;
  responsibility_type: 'provider' | 'customer' | 'shared' | 'inherited';
  responsibility_note?: string;
  created_at: string;
  updated_at: string;
}
