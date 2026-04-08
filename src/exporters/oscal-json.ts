/**
 * OSCAL JSON Exporter
 *
 * Generates OSCAL 1.1.2 JSON documents from the Crosswalk database.
 * Supports two document types:
 *   - Component Definition (describes a product's control implementations)
 *   - System Security Plan (SSP) (simplified narrative plan)
 */

import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { generateUuid } from '../utils/uuid.js';

// ---------------------------------------------------------------------------
// Shared DB row types
// ---------------------------------------------------------------------------

interface OrgRow {
  id: string;
  name: string;
  description: string | null;
}

interface ScopeRow {
  id: string;
  name: string;
  description: string | null;
}

interface CatalogRow {
  id: string;
  name: string;
  short_name: string;
  source_url: string | null;
}

interface ImplRow {
  impl_id: string;
  control_native_id: string;
  catalog_short_name: string;
  statement: string;
  status: string;
  responsible_role: string | null;
}

// ---------------------------------------------------------------------------
// Component Definition
// ---------------------------------------------------------------------------

/**
 * Exports an OSCAL 1.1.2 Component Definition document.
 *
 * The Component Definition describes how a software component (the scope)
 * implements controls from one or more catalogs.
 *
 * @param scopeName         Name of the scope/component to export.
 * @param catalogShortNames Catalogs to include (all if empty).
 * @param outputPath        File path for the output JSON.
 * @param db                Open database instance.
 */
export function exportOscalComponentDefinition(
  scopeName: string,
  catalogShortNames: string[],
  outputPath: string,
  db: Database.Database
): { components: number; implementations: number } {
  const org = _requireOrg(db);
  const scope = _requireScope(scopeName, db);
  const catalogs = _loadCatalogs(catalogShortNames, db);
  const implementations = _loadImplementations(
    scope.id,
    catalogs.map((c) => c.short_name),
    db
  );

  // Group implementations by catalog for control-implementations array
  const implsByCatalog = new Map<string, ImplRow[]>();
  for (const impl of implementations) {
    const list = implsByCatalog.get(impl.catalog_short_name) ?? [];
    list.push(impl);
    implsByCatalog.set(impl.catalog_short_name, list);
  }

  // Build control-implementations sections
  const controlImplementations = catalogs
    .filter((cat) => implsByCatalog.has(cat.short_name))
    .map((cat) => ({
      uuid: generateUuid(),
      source: cat.source_url ?? '',
      description: `${cat.name} implementation`,
      'implemented-requirements': (implsByCatalog.get(cat.short_name) ?? []).map(
        (impl) => ({
          uuid: generateUuid(),
          'control-id': impl.control_native_id,
          description: impl.statement,
          props: [
            { name: 'implementation-status', value: impl.status },
            ...(impl.responsible_role
              ? [{ name: 'responsible-role', value: impl.responsible_role }]
              : []),
          ],
        })
      ),
    }));

  const doc = {
    'component-definition': {
      uuid: generateUuid(),
      metadata: {
        title: `${org.name} ${scope.name} - Control Implementation`,
        'last-modified': new Date().toISOString(),
        version: '1.0',
        'oscal-version': '1.1.2',
      },
      components: [
        {
          uuid: generateUuid(),
          type: 'software',
          title: scope.name,
          description: scope.description ?? scope.name,
          'control-implementations': controlImplementations,
        },
      ],
    },
  };

  const resolvedPath = path.resolve(outputPath);
  fs.writeFileSync(resolvedPath, JSON.stringify(doc, null, 2), 'utf-8');

  return {
    components: 1,
    implementations: implementations.length,
  };
}

// ---------------------------------------------------------------------------
// System Security Plan
// ---------------------------------------------------------------------------

/**
 * Exports a simplified OSCAL 1.1.2 System Security Plan (SSP).
 *
 * The SSP describes the system boundary and how the system implements
 * controls for each included catalog.
 *
 * @param scopeName         Name of the scope/system to export.
 * @param catalogShortNames Catalogs to include (all if empty).
 * @param outputPath        File path for the output JSON.
 * @param db                Open database instance.
 */
export function exportOscalSsp(
  scopeName: string,
  catalogShortNames: string[],
  outputPath: string,
  db: Database.Database
): { controls: number } {
  const org = _requireOrg(db);
  const scope = _requireScope(scopeName, db);
  const catalogs = _loadCatalogs(catalogShortNames, db);
  const implementations = _loadImplementations(
    scope.id,
    catalogs.map((c) => c.short_name),
    db
  );

  // Build import-profile refs (one per catalog)
  const importProfiles = catalogs.map((cat) => ({
    href: cat.source_url ?? `#${cat.short_name}`,
    'include-controls': [{ 'with-ids': [] as string[] }],
  }));

  // Build control implementations
  const controlImpls = implementations.map((impl) => ({
    uuid: generateUuid(),
    'control-id': impl.control_native_id,
    description: impl.statement,
    'implementation-status': {
      state: impl.status,
    },
    props: impl.responsible_role
      ? [{ name: 'responsible-role', value: impl.responsible_role }]
      : [],
  }));

  const doc = {
    'system-security-plan': {
      uuid: generateUuid(),
      metadata: {
        title: `${org.name} ${scope.name} - System Security Plan`,
        'last-modified': new Date().toISOString(),
        version: '1.0',
        'oscal-version': '1.1.2',
      },
      'import-profile': importProfiles,
      'system-characteristics': {
        'system-name': scope.name,
        description: scope.description ?? scope.name,
        status: { state: 'operational' },
        'system-information': {
          'information-types': [],
        },
        'authorization-boundary': {
          description: `Authorization boundary for ${scope.name}`,
        },
      },
      'system-implementation': {
        users: [],
        components: [
          {
            uuid: generateUuid(),
            type: 'this-system',
            title: scope.name,
            description: scope.description ?? scope.name,
            status: { state: 'operational' },
          },
        ],
      },
      'control-implementation': {
        description: `Control implementations for ${org.name} ${scope.name}`,
        'implemented-requirements': controlImpls,
      },
    },
  };

  const resolvedPath = path.resolve(outputPath);
  fs.writeFileSync(resolvedPath, JSON.stringify(doc, null, 2), 'utf-8');

  return { controls: implementations.length };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function _requireOrg(db: Database.Database): OrgRow {
  const org = db
    .prepare('SELECT id, name, description FROM organizations LIMIT 1')
    .get() as OrgRow | undefined;
  if (!org) {
    throw new Error('No organization found. Run `crosswalk org init` first.');
  }
  return org;
}

function _requireScope(scopeName: string, db: Database.Database): ScopeRow {
  const scope = db
    .prepare('SELECT id, name, description FROM scopes WHERE name = ? LIMIT 1')
    .get(scopeName) as ScopeRow | undefined;
  if (!scope) {
    throw new Error(`Scope not found: "${scopeName}"`);
  }
  return scope;
}

function _loadCatalogs(
  shortNames: string[],
  db: Database.Database
): CatalogRow[] {
  if (shortNames.length === 0) {
    return db
      .prepare('SELECT id, name, short_name, source_url FROM catalogs ORDER BY name')
      .all() as CatalogRow[];
  }

  const placeholders = shortNames.map(() => '?').join(', ');
  return db
    .prepare(
      `SELECT id, name, short_name, source_url FROM catalogs WHERE short_name IN (${placeholders}) ORDER BY name`
    )
    .all(...shortNames) as CatalogRow[];
}

function _loadImplementations(
  scopeId: string,
  catalogShortNames: string[],
  db: Database.Database
): ImplRow[] {
  const catalogFilter =
    catalogShortNames.length > 0
      ? `AND cat.short_name IN (${catalogShortNames.map(() => '?').join(', ')})`
      : '';

  const sql = `
    SELECT
      i.id              AS impl_id,
      c.control_id      AS control_native_id,
      cat.short_name    AS catalog_short_name,
      i.statement,
      i.status,
      i.responsible_role
    FROM implementations i
    JOIN controls c   ON i.primary_control_id = c.id
    JOIN catalogs cat ON c.catalog_id = cat.id
    WHERE (i.scope_id = ? OR i.scope_id IS NULL)
    ${catalogFilter}
    ORDER BY cat.short_name, c.sort_order, c.control_id
  `;

  const params: (string | null)[] = [scopeId, ...catalogShortNames];
  return db.prepare(sql).all(...params) as ImplRow[];
}
