import { Command } from 'commander';
import { db } from '../../db/connection.js';
import {
  exportOscalComponentDefinition,
  exportOscalSsp,
} from '../../exporters/oscal-json.js';
import { success, error } from '../../utils/logger.js';

/**
 * Registers the `crosswalk export oscal` subcommand.
 *
 * Usage:
 *   crosswalk export oscal --type component-definition|ssp
 *                          [--scope <scope_name>]
 *                          [--catalogs <comma-separated>]
 *                          --output <file.json>
 */
export function registerExportOscal(exportCommand: Command): void {
  exportCommand
    .command('oscal')
    .description('Export an OSCAL 1.1.2 JSON document')
    .requiredOption(
      '--type <type>',
      'Document type: component-definition or ssp'
    )
    .option('--scope <scope_name>', 'Scope to export (required for component-definition/ssp)')
    .option(
      '--catalogs <catalogs>',
      'Comma-separated catalog short names to include (default: all)'
    )
    .requiredOption('--output <file.json>', 'Output path for the generated JSON file')
    .action(runExportOscal);
}

interface ExportOscalOptions {
  type: string;
  scope?: string;
  catalogs?: string;
  output: string;
}

function runExportOscal(options: ExportOscalOptions): void {
  const database = db.getDb();

  if (options.type !== 'component-definition' && options.type !== 'ssp') {
    error(
      `Invalid type "${options.type}". Must be "component-definition" or "ssp".`
    );
    process.exit(1);
  }

  if (!options.scope) {
    error('--scope is required for OSCAL export.');
    process.exit(1);
  }

  const catalogShortNames: string[] = options.catalogs
    ? options.catalogs.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  try {
    if (options.type === 'component-definition') {
      const result = exportOscalComponentDefinition(
        options.scope,
        catalogShortNames,
        options.output,
        database
      );
      success(
        `OSCAL Component Definition exported: ${result.implementations} implementation(s) → ${options.output}`
      );
    } else {
      const result = exportOscalSsp(
        options.scope,
        catalogShortNames,
        options.output,
        database
      );
      success(
        `OSCAL SSP exported: ${result.controls} control(s) → ${options.output}`
      );
    }
  } catch (err) {
    error(`Export failed: ${(err as Error).message}`);
    process.exit(1);
  }
}
