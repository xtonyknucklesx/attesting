import type Database from 'better-sqlite3';
import type { Connector } from '../../models/connector.js';
import { BaseAdapter } from './base-adapter.js';
import { CISAKEVAdapter } from './adapters/cisa-kev.js';
import { NVDAdapter } from './adapters/nvd.js';

type AdapterConstructor = new (
  db: Database.Database,
  connectorId: string,
  config: Record<string, any>,
) => BaseAdapter;

/**
 * Registry of available connector adapters.
 * Maps adapter_class strings to their constructors.
 */
export class AdapterRegistry {
  private adapters = new Map<string, AdapterConstructor>();

  constructor() {
    // Register built-in adapters
    this.register('CISAKEVAdapter', CISAKEVAdapter);
    this.register('NVDAdapter', NVDAdapter);
    // Additional adapters registered here as they're built:
    // this.register('CrowdStrikeAdapter', CrowdStrikeAdapter);
    // this.register('ServiceNowITSMAdapter', ServiceNowITSMAdapter);
  }

  register(name: string, adapterClass: AdapterConstructor): void {
    this.adapters.set(name, adapterClass);
  }

  create(db: Database.Database, connector: Connector): BaseAdapter {
    const Ctor = this.adapters.get(connector.adapter_class);
    if (!Ctor) throw new Error(`Unknown adapter: ${connector.adapter_class}`);
    const config = connector.config ? JSON.parse(connector.config) : {};
    return new Ctor(db, connector.id, config);
  }

  list(): string[] {
    return [...this.adapters.keys()];
  }
}
