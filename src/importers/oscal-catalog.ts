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

interface OscalControl {
  id: string;
  title?: string;
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
function extractPartProse(parts: OscalPart[] | undefined, partName: string): string | null {
  if (!parts) return null;
  for (const part of parts) {
    if (part.name === partName && part.prose) {
      return part.prose.trim();
    }
  }
  return null;
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

  // Prepare insert statement
  const insert = db.prepare(
    `INSERT INTO controls
       (id, catalog_id, control_id, parent_control_id, title, description, guidance,
        metadata, sort_order, created_at)
     VALUES
       (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    parentUuid: string | null
  ): void {
    const controlUuid = generateUuid();
    const controlId = control.id;
    const title = control.title ?? controlId;
    const description = extractPartProse(control.parts, 'statement');
    const guidance = extractPartProse(control.parts, 'guidance');

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
      return; // Don't recurse into children of a failed control
    }

    // Recurse into nested controls (enhancements)
    if (control.controls && control.controls.length > 0) {
      for (const child of control.controls) {
        insertControl(child, groupTitle, controlUuid);
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
