import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import { createTestApp } from '../test-app.js';

describe('Risk API routes', () => {
  let app: express.Express;

  beforeAll(() => {
    ({ app } = createTestApp());
  });

  describe('GET /api/risk/register', () => {
    it('returns array', async () => {
      const res = await request(app).get('/api/risk/register');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/risk/matrix', () => {
    it('returns matrix data', async () => {
      const res = await request(app).get('/api/risk/matrix');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('matrix');
    });
  });

  describe('GET /api/risk/exceptions', () => {
    it('returns array', async () => {
      const res = await request(app).get('/api/risk/exceptions');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/risk/dashboard', () => {
    it('returns dashboard data', async () => {
      const res = await request(app).get('/api/risk/dashboard');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalOpen');
    });
  });
});
