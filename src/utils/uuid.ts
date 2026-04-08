import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a new v4 UUID string.
 */
export function generateUuid(): string {
  return uuidv4();
}
