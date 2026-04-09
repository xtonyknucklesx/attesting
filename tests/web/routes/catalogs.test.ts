import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import { createTestApp } from '../test-app.js';

describe('Catalog API routes', () => {
  let app: express.Express;

  beforeAll(() => {
    ({ app } = createTestApp());
  });

  describe('GET /api/catalogs', () => {
    it('returns array of catalogs', async () => {
      const res = await request(app).get('/api/catalogs');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('short_name');
    });
  });

  describe('GET /api/catalogs/:shortName', () => {
    it('returns catalog by short name', async () => {
      const res = await request(app).get('/api/catalogs/test-fw');
      expect(res.status).toBe(200);
      expect(res.body.short_name).toBe('test-fw');
    });

    it('returns 404 for nonexistent', async () => {
      const res = await request(app).get('/api/catalogs/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/catalogs/:shortName/controls', () => {
    it('returns controls for catalog', async () => {
      const res = await request(app).get('/api/catalogs/test-fw/controls');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('controls');
      expect(Array.isArray(res.body.controls)).toBe(true);
    });
  });
});
