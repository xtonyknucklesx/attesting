import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../../helpers/test-db.js';
import { AdapterRegistry } from '../../../src/services/connectors/registry.js';
import { BaseAdapter } from '../../../src/services/connectors/base-adapter.js';
import type Database from 'better-sqlite3';
import type { Connector } from '../../../src/models/connector.js';

describe('AdapterRegistry', () => {
  let db: Database.Database;
  let registry: AdapterRegistry;

  beforeEach(() => {
    db = createTestDb();
    registry = new AdapterRegistry();
  });

  it('list() includes CISAKEVAdapter', () => {
    const adapters = registry.list();
    expect(adapters).toContain('CISAKEVAdapter');
  });

  it('create() returns a BaseAdapter instance for a valid adapter class', () => {
    const connector: Connector = {
      id: 'test-connector-1',
      name: 'Test CISA Connector',
      connector_type: 'threat_feed',
      direction: 'inbound',
      target_module: 'multi',
      adapter_class: 'CISAKEVAdapter',
      sync_mode: 'manual',
      last_sync_status: 'never',
      is_enabled: true,
      health_status: 'unknown',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const adapter = registry.create(db, connector);
    expect(adapter).toBeInstanceOf(BaseAdapter);
  });

  it('create() throws for an unknown adapter class', () => {
    const connector: Connector = {
      id: 'test-connector-2',
      name: 'Unknown Connector',
      connector_type: 'threat_feed',
      direction: 'inbound',
      target_module: 'multi',
      adapter_class: 'NonExistentAdapter',
      sync_mode: 'manual',
      last_sync_status: 'never',
      is_enabled: true,
      health_status: 'unknown',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(() => registry.create(db, connector)).toThrowError(
      'Unknown adapter: NonExistentAdapter',
    );
  });
});
