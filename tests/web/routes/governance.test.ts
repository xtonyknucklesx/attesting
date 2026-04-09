import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import { createTestApp } from '../test-app.js';

describe('Governance API routes', () => {
  let app: express.Express;

  beforeAll(() => {
    ({ app } = createTestApp());
  });

  describe('GET /api/governance/policies', () => {
    it('returns array', async () => {
      const res = await request(app).get('/api/governance/policies');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/governance/committees', () => {
    it('returns array', async () => {
      const res = await request(app).get('/api/governance/committees');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/governance/roles', () => {
    it('returns array', async () => {
      const res = await request(app).get('/api/governance/roles');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
