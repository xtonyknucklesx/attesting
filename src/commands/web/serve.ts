import { Command } from 'commander';
import { startServer } from '../../web/server.js';

/**
 * Registers the `crosswalk serve` command.
 */
export function registerServe(program: Command): void {
  program
    .command('serve')
    .description('Start the Crosswalk web UI and API server')
    .option('--port <port>', 'Port to listen on', '3000')
    .option('--dev', 'Development mode (API only, use Vite dev server for frontend)')
    .action((options) => {
      startServer({
        port: Number(options.port),
        dev: options.dev ?? false,
      });
    });
}
