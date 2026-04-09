import * as fs from 'fs';
import Database from 'better-sqlite3';
import { generateUuid } from '../utils/uuid.js';
import { now } from '../utils/dates.js';

/**
 * Result returned after importing an OSCAL JSON catalog.
 */
export interface OscalImportResult {
  imported: number;
  errors: string[];
}

/**
 * Minimal OSCAL catalog types used for parsing.
 * The full OSCAL spec has many more fields, but we only read what we need.
 */
interface OscalPart {
  name: string;
  prose?: string;
  parts?: OscalPart[];
}

interface OscalProp {
  name: string;
  value: string;
}

export interface OscalParam {
  id: string;
  label?: string;
  select?: { 'how-many'?: string; choice?: string[] };
  values?: string[];
  guidelines?: Array<{ prose: string }>;
}

interface OscalControl {
  id: string;
  title?: string;
  params?: OscalParam[];
  parts?: OscalPart[];
  props?: OscalProp[];
  controls?: OscalControl[]; // nested enhancements
}

interface OscalGroup {
  id?: string;
  title?: string;
  controls?: OscalControl[];
  groups?: OscalGroup[];
}

interface OscalCatalog {
  uuid?: string;
  metadata?: {
    title?: string;
    version?: string;
  };
  groups?: OscalGroup[];
  controls?: OscalControl[];
}

interface OscalDocument {
  catalog: OscalCatalog;
}

/**
 * Extracts prose text for a named part from a control's parts array.
 */
export function extractPartProse(parts: OscalPart[] | undefined, partName: string): string | null {
  if (!parts) return null;
  for (const part of parts) {
    if (part.name === partName && part.prose) {
      return part.prose.trim();
    }
  }
  return null;
}

/**
 * Resolves OSCAL parameter placeholders in prose text.
 *
 * OSCAL prose contains `{{ insert: param, sa-21_odp.01 }}` references
 * that should be replaced with the parameter's label, selection choices,
 * or a readable placeholder like `[selection: choice1; choice2]`.
 */
export function resolveParams(prose: string | null, params: OscalParam[] | undefined): string | null {
  if (!prose || !params || params.length === 0) return prose;
  const paramMap = new Map(params.map((p) => [p.id, p]));

  return prose.replace(/\{\{\s*insert:\s*param,\s*([^}\s]+)\s*\}\}/g, (_match, paramId: string) => {
    const param = paramMap.get(paramId);
    if (!param) return `[${paramId}]`;

    // Use values if set
    if (param.values && param.values.length > 0) {
      return param.values.join(', ');
    }
    // Use label as readable placeholder
    if (param.label) {
      return `[${param.label}]`;
    }
    // Use select choices
    if (param.select?.choice && param.select.choice.length > 0) {
      const how = param.select['how-many'] === 'one-or-more' ? 'one or more' : 'one';
      return `[selection (${how}): ${param.select.choice.join('; ')}]`;
    }
    return `[${paramId}]`;
  });
}

/**
 * Imports controls from an OSCAL JSON catalog file into the database.
 *
 * Reads the file synchronously (better-sqlite3 is also synchronous).
 * Walks the groups → controls → nested controls tree recursively.
 *
 * @param filePath   Absolute path to the OSCAL JSON file.
 * @param catalogId  UUID of the pre-created catalog record.
 * @param db         Open better-sqlite3 database instance.
 */
export function importOscalCatalog(
  filePath: string,
  catalogId: string,
  db: Database.Database
): OscalImportResult {
  const errors: string[] = [];
  let imported = 0;
  let sortIndex = 0;

  // Read and parse the OSCAL JSON file
  let document: OscalDocument;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    document = JSON.parse(raw) as OscalDocument;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { imported: 0, errors: [`Failed to read/parse OSCAL file: ${msg}`] };
  }

  const catalog = document.catalog;
  if (!catalog) {
    return { imported: 0, errors: ['OSCAL file has no "catalog" root key'] };
  }

  // Update catalog record with OSCAL UUID if present
  if (catalog.uuid) {
    db.prepare('UPDATE catalogs SET oscal_uuid = ?, updated_at = ? WHERE id = ?')
      .run(catalog.uuid, now(), catalogId);
  }

  // Prepare insert statements
  const insert = db.prepare(
    `INSERT INTO controls
       (id, catalog_id, control_id, parent_control_id, title, description, guidance,
        metadata, sort_order, created_at)
     VALUES
       (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  // Ensure control_params table exists (for existing databases)
  db.exec(`CREATE TABLE IF NOT EXISTS control_params (
    id TEXT PRIMARY KEY, control_id TEXT NOT NULL REFERENCES controls(id) ON DELETE CASCADE,
    param_id TEXT NOT NULL, label TEXT, description TEXT, default_value TEXT,
    value TEXT, set_by TEXT, set_at TEXT, UNIQUE(control_id, param_id)
  )`);

  const insertParam = db.prepare(
    `INSERT OR IGNORE INTO control_params (id, control_id, param_id, label, description, default_value)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  /**
   * Recursively inserts a control and its nested enhancements.
   *
   * @param control        The OSCAL control object to insert.
   * @param groupTitle     Title of the containing group (stored as metadata.family).
   * @param parentUuid     Internal UUID of the parent control, if any.
   */
  function insertControl(
    control: OscalControl,
    groupTitle: string | undefined,
    parentUuid: string | null,
    inheritedParams?: OscalParam[]
  ): void {
    const controlUuid = generateUuid();
    const controlId = control.id;
    const title = control.title ?? controlId;
    const allParams = [...(inheritedParams ?? []), ...(control.params ?? [])];
    const rawDescription = extractPartProse(control.parts, 'statement');
    const rawGuidance = extractPartProse(control.parts, 'guidance');
    const description = resolveParams(rawDescription, allParams);
    const guidance = resolveParams(rawGuidance, allParams);

    const metadata = JSON.stringify({
      family: groupTitle ?? null,
    });

    try {
      insert.run(
        controlUuid,
        catalogId,
        controlId,
        parentUuid,
        title,
        description,
        guidance,
        metadata,
        sortIndex++,
        now()
      );
      imported++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Control "${controlId}": ${msg}`);
      return;
    }

    // Store this control's own params (not inherited — those belong to the parent)
    if (control.params) {
      for (const p of control.params) {
        const guideline = p.guidelines?.[0]?.prose ?? null;
        const defaultVal = p.select?.choice?.join('; ') ?? p.values?.[0] ?? null;
        try {
          insertParam.run(generateUuid(), controlUuid, p.id, p.label ?? null, guideline, defaultVal);
        } catch { /* ignore duplicates */ }
      }
    }

    // Recurse into nested controls (enhancements)
    if (control.controls && control.controls.length > 0) {
      for (const child of control.controls) {
        insertControl(child, groupTitle, controlUuid, allParams);
      }
    }
  }

  /**
   * Recursively processes a group (which may contain controls or nested groups).
   */
  function processGroup(group: OscalGroup): void {
    // Process controls in this group
    if (group.controls) {
      for (const control of group.controls) {
        insertControl(control, group.title, null);
      }
    }
    // Recurse into nested groups
    if (group.groups) {
      for (const subGroup of group.groups) {
        processGroup(subGroup);
      }
    }
  }

  // Run everything in a transaction for performance
  const runImport = db.transaction(() => {
    // Process top-level groups
    if (catalog.groups) {
      for (const group of catalog.groups) {
        processGroup(group);
      }
    }

    // Process any top-level controls (less common but valid OSCAL)
    if (catalog.controls) {
      for (const control of catalog.controls) {
        insertControl(control, undefined, null);
      }
    }
  });

  runImport();

  return { imported, errors };
}
