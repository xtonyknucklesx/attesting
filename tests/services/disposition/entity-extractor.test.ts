/**
 * Tests for entity extraction — pulls structured references
 * (NIST controls, Jira tickets, CMMC practices, etc.) from analyst text.
 *
 * Pure functions, no database dependency.
 */

import { describe, it, expect } from 'vitest';
import { extractEntities, extractTemporalRef } from '../../../src/services/disposition/entity-extractor.js';

describe('extractEntities', () => {
  it('extracts NIST control references', () => {
    const entities = extractEntities('See NIST control AC-2 and SI-4');
    const nist = entities.filter(e => e.type === 'nist_control');
    expect(nist.length).toBe(2);

    const values = nist.map(e => e.value);
    expect(values).toContain('AC-2');
    expect(values).toContain('SI-4');
  });

  it('extracts Jira ticket references', () => {
    const entities = extractEntities('Jira ticket PROJ-123');
    const jira = entities.filter(e => e.type === 'jira_ticket');
    expect(jira.length).toBe(1);
    expect(jira[0].value).toBe('PROJ-123');
  });

  it('extracts CMMC practice references', () => {
    const entities = extractEntities('CMMC practice AC.L2-3.1.1');
    const cmmc = entities.filter(e => e.type === 'cmmc_practice');
    expect(cmmc.length).toBe(1);
    expect(cmmc[0].value).toBe('AC.L2-3.1.1');
  });

  it('extracts NISPOM section references', () => {
    const entities = extractEntities('NISPOM 117.15');
    const nispom = entities.filter(e => e.type === 'nispom_section');
    expect(nispom.length).toBe(1);
    expect(nispom[0].value).toBe('15');
  });

  it('extracts multiple entity types from one string and deduplicates', () => {
    const text = 'See AC-2, PROJ-456, and AC-2 again for reference';
    const entities = extractEntities(text);

    // AC-2 should appear only once despite being mentioned twice
    const nist = entities.filter(e => e.type === 'nist_control' && e.value === 'AC-2');
    expect(nist.length).toBe(1);

    // PROJ-456 should also be found
    const jira = entities.filter(e => e.type === 'jira_ticket' && e.value === 'PROJ-456');
    expect(jira.length).toBe(1);
  });

  it('returns empty array for empty string', () => {
    const entities = extractEntities('');
    expect(entities).toEqual([]);
  });

  it('includes position and full_match on each entity', () => {
    const entities = extractEntities('Check AC-2 please');
    const ctrl = entities.find(e => e.value === 'AC-2');
    expect(ctrl).toBeDefined();
    expect(typeof ctrl!.position).toBe('number');
    expect(ctrl!.full_match).toBeTruthy();
  });
});

describe('extractTemporalRef', () => {
  it('resolves "Fix by next quarter" to a date', () => {
    const ref = extractTemporalRef('Fix by next quarter');
    expect(ref).not.toBeNull();
    expect(ref!.resolved_date).toBeTruthy();
    // resolved_date should be a valid YYYY-MM-DD string
    expect(ref!.resolved_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('resolves "Deferring to Q2" to end of Q2', () => {
    const ref = extractTemporalRef('Deferring to Q2');
    expect(ref).not.toBeNull();
    expect(ref!.type).toBe('quarter');
    expect(ref!.resolved_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Q2 ends on June 30
    expect(ref!.resolved_date).toContain('-06-30');
  });

  it('returns null when no temporal reference is present', () => {
    const ref = extractTemporalRef('No time reference here');
    expect(ref).toBeNull();
  });

  it('resolves "next month" to roughly 30 days from now', () => {
    const ref = extractTemporalRef('We will fix it next month');
    expect(ref).not.toBeNull();
    expect(ref!.type).toBe('relative');

    const resolved = new Date(ref!.resolved_date);
    const now = new Date();
    const diffDays = Math.round((resolved.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    // Should be approximately 30 days in the future
    expect(diffDays).toBeGreaterThanOrEqual(28);
    expect(diffDays).toBeLessThanOrEqual(32);
  });
});
