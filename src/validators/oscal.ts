/**
 * OSCAL Validator
 *
 * Validates FedRAMP OSCAL documents (SSP, POA&M, Component Definition)
 * against structural, metadata, and FedRAMP business rules.
 *
 * Rule IDs match the Python oscal_validator.py reference implementation:
 *   PARSE-001/002  — JSON parse errors
 *   STRUCT-001..004 — OSCAL document structure
 *   META-001..004  — Metadata fields
 *   SSP-001..033   — SSP-specific (system characteristics, implementations, baseline)
 *   POAM-001..011  — POA&M-specific
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Severity = 'ERROR' | 'WARNING' | 'INFO';

export interface Finding {
  severity: Severity;
  rule: string;
  message: string;
  path: string;
}

export interface ValidationResult {
  passed: boolean;
  errors: Finding[];
  warnings: Finding[];
  info: Finding[];
  all: Finding[];
  summary: string;
}

export type OscalDocType = 'ssp' | 'sap' | 'sar' | 'poam' | 'catalog' | 'profile' | 'component-definition';

const DOCUMENT_ROOT_KEYS: Record<string, string> = {
  'ssp': 'system-security-plan',
  'sap': 'assessment-plan',
  'sar': 'assessment-results',
  'poam': 'plan-of-action-and-milestones',
  'catalog': 'catalog',
  'profile': 'profile',
  'component-definition': 'component-definition',
};

// ---------------------------------------------------------------------------
// Finding collector
// ---------------------------------------------------------------------------

class FindingCollector {
  errors: Finding[] = [];
  warnings: Finding[] = [];
  info: Finding[] = [];

  error(rule: string, message: string, path: string = '') {
    this.errors.push({ severity: 'ERROR', rule, message, path });
  }
  warning(rule: string, message: string, path: string = '') {
    this.warnings.push({ severity: 'WARNING', rule, message, path });
  }
  information(rule: string, message: string, path: string = '') {
    this.info.push({ severity: 'INFO', rule, message, path });
  }

  get passed(): boolean { return this.errors.length === 0; }
  get all(): Finding[] { return [...this.errors, ...this.warnings, ...this.info]; }
  get summary(): string {
    return `Errors: ${this.errors.length}, Warnings: ${this.warnings.length}, Info: ${this.info.length}`;
  }

  toResult(): ValidationResult {
    return {
      passed: this.passed,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info,
      all: this.all,
      summary: this.summary,
    };
  }
}

// ---------------------------------------------------------------------------
// Generic OSCAL structural validation
// ---------------------------------------------------------------------------

function validateStructure(data: Record<string, unknown>, docType: string, r: FindingCollector): void {
  const rootKey = DOCUMENT_ROOT_KEYS[docType];
  if (!rootKey) {
    r.error('STRUCT-001', `Unknown document type: ${docType}`);
    return;
  }

  if (!(rootKey in data)) {
    r.error('STRUCT-002', `Missing root element: '${rootKey}'`, '/');
    return;
  }

  const doc = data[rootKey] as Record<string, unknown>;

  // UUID required on root
  if (!doc.uuid) {
    r.error('STRUCT-003', "Document missing required 'uuid' field", `/${rootKey}`);
  }

  // Metadata required
  const metadata = doc.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    r.error('STRUCT-004', "Document missing required 'metadata' section", `/${rootKey}`);
    return;
  }

  // Metadata fields
  if (!metadata.title) {
    r.error('META-001', "Metadata missing 'title'", `/${rootKey}/metadata`);
  }
  if (!metadata['last-modified']) {
    r.error('META-002', "Metadata missing 'last-modified'", `/${rootKey}/metadata`);
  }
  if (!metadata.version) {
    r.warning('META-003', "Metadata missing 'version'", `/${rootKey}/metadata`);
  }

  const oscalVersion = (metadata['oscal-version'] as string) ?? '';
  if (oscalVersion && !oscalVersion.startsWith('1.')) {
    r.warning('META-004', `Unexpected OSCAL version: ${oscalVersion}`, `/${rootKey}/metadata`);
  }
}

// ---------------------------------------------------------------------------
// SSP validation (SSP-001 through SSP-033)
// ---------------------------------------------------------------------------

function validateSsp(data: Record<string, unknown>, r: FindingCollector, strict: boolean): void {
  const ssp = data['system-security-plan'] as Record<string, unknown> | undefined;
  if (!ssp) return;

  // --- System Characteristics ---
  const chars = ssp['system-characteristics'] as Record<string, unknown> | undefined;
  if (!chars) {
    r.error('SSP-001', "Missing 'system-characteristics' section");
  } else {
    if (!chars['system-name']) {
      r.error('SSP-002', 'Missing system name');
    }
    if (!chars.description) {
      r.warning('SSP-003', 'Missing system description');
    }
    if (!chars['security-sensitivity-level']) {
      r.error('SSP-004', 'Missing security sensitivity level');
    }

    // Authorization boundary
    const boundary = (chars['authorization-boundary'] as Record<string, unknown>) ?? {};
    if (!boundary.description) {
      r.error('SSP-005', 'Missing authorization boundary description. This is the #1 cause of RAR rejection.');
    }

    // Security impact level
    const impact = (chars['security-impact-level'] as Record<string, unknown>) ?? {};
    for (const dim of [
      'security-objective-confidentiality',
      'security-objective-integrity',
      'security-objective-availability',
    ]) {
      if (!impact[dim]) {
        r.error('SSP-006', `Missing ${dim} in security-impact-level`);
      }
    }
  }

  // --- System Implementation ---
  const impl = ssp['system-implementation'] as Record<string, unknown> | undefined;
  if (!impl) {
    r.error('SSP-010', "Missing 'system-implementation' section");
  } else {
    const components = (impl.components as Record<string, unknown>[]) ?? [];
    if (components.length === 0) {
      r.error('SSP-011', 'No components defined in system-implementation');
    }

    const hasThisSystem = components.some((c) => c.type === 'this-system');
    if (!hasThisSystem) {
      r.warning('SSP-012', "No 'this-system' component found (recommended by FedRAMP)");
    }

    // Collect component UUIDs for reference checking
    var componentUuids = new Set(components.map((c) => c.uuid as string).filter(Boolean));
  }

  // --- Control Implementation ---
  const ctrlImpl = ssp['control-implementation'] as Record<string, unknown> | undefined;
  if (!ctrlImpl) {
    r.error('SSP-020', "Missing 'control-implementation' section");
    return;
  }

  const reqs = (ctrlImpl['implemented-requirements'] as Record<string, unknown>[]) ?? [];
  if (reqs.length === 0) {
    r.error('SSP-021', 'No implemented-requirements in control-implementation');
    return;
  }

  // Validate each implemented requirement
  const controlIdsFound = new Set<string>();
  const validStatuses = new Set(['implemented', 'partial', 'planned', 'alternative', 'not-applicable']);

  for (let idx = 0; idx < reqs.length; idx++) {
    const req = reqs[idx];
    const cid = (req['control-id'] as string) ?? '';
    if (!cid) {
      r.error('SSP-022', `Missing control-id in implemented-requirement[${idx}]`);
      continue;
    }

    controlIdsFound.add(cid.toUpperCase());

    if (!req.uuid) {
      r.error('SSP-023', `Missing uuid for ${cid}`);
    }

    // Check implementation-status prop
    const props = (req.props as Record<string, unknown>[]) ?? [];
    const statusProp = props.find((p) => p.name === 'implementation-status');

    if (!statusProp) {
      r.warning('SSP-025', `${cid}: Missing implementation-status property`);
    } else if (!validStatuses.has(statusProp.value as string)) {
      r.warning('SSP-024', `${cid}: implementation-status '${statusProp.value}' not in standard values`);
    }

    // Check by-components
    const byComps = (req['by-components'] as Record<string, unknown>[]) ?? [];
    if (byComps.length === 0) {
      if (strict) {
        r.error('SSP-026', `${cid}: No by-components entries (FedRAMP requires component-level narratives)`);
      } else {
        r.warning('SSP-026', `${cid}: No by-components entries`);
      }
    } else {
      for (const bc of byComps) {
        const compUuid = bc['component-uuid'] as string;
        if (compUuid && componentUuids && !componentUuids.has(compUuid)) {
          r.error('SSP-027', `${cid}: References unknown component ${compUuid}`);
        }
        if (!bc.description) {
          r.warning('SSP-028', `${cid}: Empty implementation description in by-component`);
        }
      }
    }
  }

  // Report control coverage
  r.information('SSP-032', `Control coverage: ${controlIdsFound.size} controls with implementations`);
}

// ---------------------------------------------------------------------------
// POA&M validation (POAM-001 through POAM-011)
// ---------------------------------------------------------------------------

function validatePoam(data: Record<string, unknown>, r: FindingCollector): void {
  const poam = data['plan-of-action-and-milestones'] as Record<string, unknown> | undefined;
  if (!poam) {
    // Check for toolkit custom format
    if ('items' in data) {
      r.information('POAM-001', 'Document uses toolkit POA&M format (not raw OSCAL)');
      const items = (data.items as Record<string, unknown>[]) ?? [];
      for (let idx = 0; idx < items.length; idx++) {
        if (!items[idx].poam_id) r.error('POAM-010', `Item[${idx}] missing poam_id`);
        if (!items[idx].title) r.warning('POAM-011', `Item[${idx}] missing title`);
      }
      return;
    }
    r.error('POAM-002', 'Not a valid OSCAL POA&M or toolkit POA&M format');
    return;
  }

  const findings = (poam.findings ?? poam['poam-items']) as unknown[] | undefined;
  if (!findings || findings.length === 0) {
    r.warning('POAM-003', 'No findings/poam-items in document');
  }
}

// ---------------------------------------------------------------------------
// Component Definition validation
// ---------------------------------------------------------------------------

function validateComponentDef(data: Record<string, unknown>, r: FindingCollector): void {
  const cd = data['component-definition'] as Record<string, unknown> | undefined;
  if (!cd) return;

  const components = (cd.components as Record<string, unknown>[]) ?? [];
  if (components.length === 0) {
    r.warning('CD-001', 'No components in component-definition');
    return;
  }

  for (const comp of components) {
    if (!comp.uuid) r.error('CD-002', `Component missing uuid: ${comp.title ?? 'untitled'}`);
    if (!comp.type) r.error('CD-003', `Component missing type: ${comp.title ?? 'untitled'}`);
    if (!comp.title) r.warning('CD-004', 'Component missing title');

    const cis = (comp['control-implementations'] as Record<string, unknown>[]) ?? [];
    for (const ci of cis) {
      const reqs = (ci['implemented-requirements'] as Record<string, unknown>[]) ?? [];
      for (const req of reqs) {
        if (!req.uuid) r.warning('CD-010', `implemented-requirement missing uuid`);
        if (!req['control-id']) r.error('CD-011', 'implemented-requirement missing control-id');
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate an OSCAL document from a parsed JS object.
 */
export function validateOscalDocument(
  data: Record<string, unknown>,
  docType: OscalDocType,
  options: { strict?: boolean } = {}
): ValidationResult {
  const r = new FindingCollector();
  const strict = options.strict ?? false;

  // Structural validation (all types)
  validateStructure(data, docType, r);

  // Type-specific validation
  switch (docType) {
    case 'ssp':
      validateSsp(data, r, strict);
      break;
    case 'poam':
      validatePoam(data, r);
      break;
    case 'component-definition':
      validateComponentDef(data, r);
      break;
  }

  return r.toResult();
}

/**
 * Validate an OSCAL document from a file path.
 */
export function validateOscalFile(
  filePath: string,
  docType: OscalDocType,
  options: { strict?: boolean } = {}
): ValidationResult {
  const r = new FindingCollector();

  let raw: string;
  try {
    raw = fs.readFileSync(path.resolve(filePath), 'utf-8');
  } catch (err) {
    r.error('PARSE-002', `Could not read file: ${(err as Error).message}`);
    return r.toResult();
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    r.error('PARSE-001', `Invalid JSON: ${(err as Error).message}`);
    return r.toResult();
  }

  r.information('PARSE-OK', `Successfully parsed ${path.basename(filePath)} (${raw.length} bytes)`);

  // Delegate to in-memory validator
  const innerResult = validateOscalDocument(data, docType, options);

  // Merge findings
  r.errors.push(...innerResult.errors);
  r.warnings.push(...innerResult.warnings);
  r.info.push(...innerResult.info);

  return r.toResult();
}
