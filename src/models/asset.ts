/** A network, physical, or logical boundary containing assets. */
export interface AssetBoundary {
  id: string;
  name: string;
  description?: string;
  boundary_type: 'network' | 'physical' | 'logical' | 'cloud' | 'hybrid';
  created_at: string;
}

/** A system, endpoint, application, or service in the inventory. */
export interface Asset {
  id: string;
  name: string;
  asset_type:
    | 'server' | 'endpoint' | 'application' | 'database'
    | 'network_device' | 'cloud_service' | 'data_store'
    | 'iot' | 'virtual' | 'other';
  platform?: string;
  os_version?: string;
  data_classification: 'unclassified' | 'cui' | 'confidential' | 'secret' | 'top_secret';
  boundary_id?: string;
  owner_id?: string;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'decommissioned' | 'planned' | 'maintenance';
  external_id?: string;
  external_source?: string;
  metadata?: string;
  last_scanned?: string;
  created_at: string;
  updated_at: string;
}
