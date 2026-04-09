export type ConnectorType =
  | 'threat_feed' | 'asset_inventory' | 'siem' | 'ticketing'
  | 'identity' | 'sbom' | 'vulnerability_scanner' | 'cloud_provider'
  | 'compliance_tool' | 'communication' | 'custom';

export type SyncStatus = 'never' | 'success' | 'partial' | 'failed' | 'syncing';
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/** Configuration for an external system integration. */
export interface Connector {
  id: string;
  name: string;
  connector_type: ConnectorType;
  direction: 'inbound' | 'outbound' | 'bidirectional';
  target_module: 'risk' | 'asset' | 'compliance' | 'governance' | 'evidence' | 'multi';
  adapter_class: string;
  config?: string;
  auth_method?: 'api_key' | 'oauth2' | 'basic' | 'certificate' | 'webhook' | 'none';
  sync_mode: 'scheduled' | 'webhook' | 'manual' | 'event_driven';
  sync_interval?: number;
  last_sync_at?: string;
  last_sync_status: SyncStatus;
  last_sync_error?: string;
  last_sync_stats?: string;
  is_enabled: boolean;
  health_status: HealthStatus;
  health_checked_at?: string;
  created_at: string;
  updated_at: string;
}

/** Stats from a single connector sync run. */
export interface SyncStats {
  processed: number;
  created: number;
  updated: number;
  deleted: number;
  errors: number;
}

export interface SyncLogEntry {
  id: string;
  connector_id: string;
  started_at: string;
  completed_at?: string;
  status: 'running' | 'success' | 'partial' | 'failed' | 'cancelled';
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_deleted: number;
  errors: number;
  error_details?: string;
  sync_type: 'full' | 'incremental' | 'delta' | 'manual';
  trigger: 'scheduled' | 'webhook' | 'manual' | 'event';
}
