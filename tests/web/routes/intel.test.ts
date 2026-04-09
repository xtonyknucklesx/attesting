import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import { createTestApp } from '../test-app.js';

describe('Intel API routes', () => {
  let app: express.Express;

  beforeAll(() => {
    ({ app } = createTestApp());
  });

  describe('GET /api/intel/threats', () => {
    it('returns array', async () => {
      const res = await request(app).get('/api/intel/threats');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/intel/manual', () => {
    it('returns array', async () => {
      const res = await request(app).get('/api/intel/manual');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/intel/manual', () => {
    it('submits manual intel', async () => {
      const res = await request(app)
        .post('/api/intel/manual')
        .send({ title: 'Test Threat', description: 'Suspicious activity', severityEstimate: 'high' });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('provisional');
    });
  });

  describe('GET /api/intel/threats/:id', () => {
    it('returns 404 for nonexistent', async () => {
      const res = await request(app).get('/api/intel/threats/nonexistent');
      expect(res.status).toBe(404);
    });
  });
});
