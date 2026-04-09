/** A person responsible for policies, controls, assets, or risks. */
export interface Owner {
  id: string;
  name: string;
  email?: string;
  role?: string;
  department?: string;
  clearance_level?: string;
  is_supervisor: boolean;
  created_at: string;
  updated_at: string;
}
