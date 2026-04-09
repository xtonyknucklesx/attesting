/**
 * Tests for disposition classifier — converts analyst free-text
 * into a structured disposition type via pattern matching.
 *
 * Pure function, no database dependency.
 */

import { describe, it, expect } from 'vitest';
import { classifyDisposition } from '../../../src/services/disposition/classifier.js';

describe('classifyDisposition', () => {
  // ── Core type classification ────────────────────────────────

  it('classifies "We have accepted the risk" as accepted_risk', () => {
    const result = classifyDisposition('We have accepted the risk');
    expect(result.type).toBe('accepted_risk');
    expect(result.match).toBeTruthy();
  });

  it('classifies "This is by design, we configured it that way" as by_design', () => {
    const result = classifyDisposition('This is by design, we configured it that way');
    expect(result.type).toBe('by_design');
    expect(result.match).toBeTruthy();
  });

  it('classifies "Covered by a compensating control AC-4" as compensating_control', () => {
    const result = classifyDisposition('Covered by a compensating control AC-4');
    expect(result.type).toBe('compensating_control');
    expect(result.match).toBeTruthy();
  });

  it('classifies "Deferring to next quarter" as deferred', () => {
    const result = classifyDisposition('Deferring to next quarter');
    expect(result.type).toBe('deferred');
    expect(result.match).toBeTruthy();
  });

  it('classifies "This is a false positive" as false_positive', () => {
    const result = classifyDisposition('This is a false positive');
    expect(result.type).toBe('false_positive');
    expect(result.match).toBeTruthy();
  });

  it('classifies "Not applicable to our environment" as not_applicable', () => {
    const result = classifyDisposition('Not applicable to our environment');
    expect(result.type).toBe('not_applicable');
    expect(result.match).toBeTruthy();
  });

  // ── Edge cases ──────────────────────────────────────────────

  it('returns deferred with low confidence and ambiguous flag for empty string', () => {
    const result = classifyDisposition('');
    expect(result.type).toBe('deferred');
    expect(result.confidence).toBeLessThan(0.5);
    expect(result.ambiguous).toBe(true);
  });

  it('detects ambiguity when multiple types match', () => {
    // "accepted the risk" → accepted_risk, "not applicable" → not_applicable
    const result = classifyDisposition('We have accepted the risk since it is not applicable');
    expect(result.ambiguous).toBe(true);
    expect(result.alternatives.length).toBeGreaterThan(0);
  });

  // ── Confidence range ────────────────────────────────────────

  it('returns confidence between 0 and 1 for each classification', () => {
    const inputs = [
      'We have accepted the risk',
      'This is by design, we configured it that way',
      'Covered by a compensating control AC-4',
      'Deferring to next quarter',
      'This is a false positive',
      'Not applicable to our environment',
      '',
      'We have accepted the risk but it does not apply',
    ];

    for (const text of inputs) {
      const result = classifyDisposition(text);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });

  // ── Return shape ────────────────────────────────────────────

  it('always returns the expected shape', () => {
    const result = classifyDisposition('random text');
    expect(result).toHaveProperty('type');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('match');
    expect(result).toHaveProperty('ambiguous');
    expect(result).toHaveProperty('alternatives');
    expect(Array.isArray(result.alternatives)).toBe(true);
  });
});
