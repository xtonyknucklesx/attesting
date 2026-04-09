/**
 * Shared test app factory for API integration tests.
 * Builds an Express app with an in-memory database.
 */
import { createTestDb, seedOrg, seedCatalog, seedImplementation } from '../helpers/test-db.js';
import { db } from '../../src/db/connection.js';
import { createApp } from '../../src/web/server.js';
import type Database from 'better-sqlite3';
import type express from 'express';

/**
 * Creates a test Express app with seeded in-memory database.
 * Overrides the singleton db connection.
 */
export function createTestApp(): { app: express.Express; database: Database.Database } {
  const database = createTestDb();

  // Seed minimal data
  const { orgId } = seedOrg(database);
  const { controlIds } = seedCatalog(database, 3);
  seedImplementation(database, orgId, controlIds[0]);

  // Override the singleton db
  (db as any)._db = database;
  (db as any).getDb = () => database;

  const app = createApp();
  return { app, database };
}
