/**
 * Returns the current date/time as an ISO 8601 string.
 * Example: "2026-04-08T14:32:00.000Z"
 */
export function now(): string {
  return new Date().toISOString();
}
