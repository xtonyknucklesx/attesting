import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * DatabaseManager handles the SQLite connection lifecycle.
 * The database file lives at ~/.crosswalk/crosswalk.db.
 * On first connect the schema is applied if the database is empty.
 */
export class DatabaseManager {
  private db: Database.Database | null = null;
  private readonly dbPath: string;

  constructor() {
    const dir = path.join(os.homedir(), '.crosswalk');
    this.dbPath = path.join(dir, 'crosswalk.db');

    // Ensure the directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Returns the open Database instance, initializing it on first call.
   */
  getDb(): Database.Database {
    if (this.db) {
      return this.db;
    }

    this.db = new Database(this.dbPath);

    // Enable WAL mode for better concurrency characteristics
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    // Apply schema if the database is brand new (no tables yet)
    const tableCount = (
      this.db
        .prepare(
          "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
        )
        .get() as { cnt: number }
    ).cnt;

    if (tableCount === 0) {
      this.applySchema();
    }

    return this.db;
  }

  /**
   * Reads schema.sql from the package root (works for both tsx dev and dist/ build)
   * and executes it against the open database.
   */
  private applySchema(): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const schemaPath = this.resolveSchemaPath();
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

    // Execute the entire schema in a single transaction
    this.db.exec(schemaSql);
  }

  /**
   * Walks up from __dirname to find schema.sql regardless of whether
   * we are running from src/ (via tsx) or dist/ (compiled build).
   */
  private resolveSchemaPath(): string {
    // Try relative paths from __dirname outward
    const candidates = [
      // Running via tsx: __dirname = src/db
      path.join(__dirname, 'schema.sql'),
      // Running from dist/db after tsc build
      path.join(__dirname, '../../src/db/schema.sql'),
      // Fallback: project root relative
      path.join(__dirname, '../db/schema.sql'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    throw new Error(
      `schema.sql not found. Searched:\n${candidates.join('\n')}`
    );
  }

  /**
   * Closes the database connection if open.
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

/** Singleton database manager instance for the process lifetime. */
export const db = new DatabaseManager();
