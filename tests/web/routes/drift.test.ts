import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import { createTestApp } from '../test-app.js';

describe('Drift API routes', () => {
  let app: express.Express;

  beforeAll(() => {
    ({ app } = createTestApp());
  });

  describe('GET /api/drift/alerts', () => {
    it('returns array', async () => {
      const res = await request(app).get('/api/drift/alerts');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('respects status filter', async () => {
      const res = await request(app).get('/api/drift/alerts?status=resolved');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/drift/dashboard', () => {
    it('returns dashboard stats', async () => {
      const res = await request(app).get('/api/drift/dashboard');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('active');
      expect(res.body).toHaveProperty('bySeverity');
      expect(res.body).toHaveProperty('byType');
      expect(res.body).toHaveProperty('pendingApprovals');
    });
  });

  describe('GET /api/drift/dispositions/pending', () => {
    it('returns array', async () => {
      const res = await request(app).get('/api/drift/dispositions/pending');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/drift/dispositions', () => {
    it('returns 400 without required fields', async () => {
      const res = await request(app).post('/api/drift/dispositions').send({});
      expect(res.status).toBe(400);
    });
  });
});
