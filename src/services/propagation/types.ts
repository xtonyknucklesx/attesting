import type { Actor } from '../audit/logger.js';

/** A single entry in the propagation log for tracing cascades. */
export interface PropagationEntry {
  type: string;
  timestamp: string;
  dry_run: boolean;
  [key: string]: unknown;
}

/** Context passed to every propagation handler. */
export interface PropagationContext {
  dryRun: boolean;
  log: PropagationEntry[];
  actor: Actor;
}

/** Creates a fresh propagation context. */
export function createContext(actor: Actor, dryRun = false): PropagationContext {
  return { dryRun, log: [], actor };
}

/** Appends an entry to the propagation log. */
export function logEntry(
  ctx: PropagationContext,
  type: string,
  data: Record<string, unknown>,
): void {
  ctx.log.push({
    type,
    timestamp: new Date().toISOString(),
    dry_run: ctx.dryRun,
    ...data,
  });
}
