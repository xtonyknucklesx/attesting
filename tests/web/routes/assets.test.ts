import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import { createTestApp } from '../test-app.js';
import { seedAsset } from '../../helpers/test-db.js';

describe('Asset API routes', () => {
  let app: express.Express;
  let database: any;

  beforeAll(() => {
    const result = createTestApp();
    app = result.app;
    database = result.database;
  });

  describe('GET /api/assets', () => {
    it('returns empty array initially', async () => {
      const res = await request(app).get('/api/assets');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/assets', () => {
    it('creates an asset', async () => {
      const res = await request(app)
        .post('/api/assets')
        .send({ name: 'Web Server', asset_type: 'server', platform: 'aws' });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });

    it('returns 400 without required fields', async () => {
      const res = await request(app).post('/api/assets').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/assets/:id', () => {
    it('returns asset with relationships', async () => {
      const id = seedAsset(database, { name: 'Detail Test', platform: 'linux' });
      const res = await request(app).get(`/api/assets/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Detail Test');
      expect(res.body).toHaveProperty('threats');
      expect(res.body).toHaveProperty('risks');
    });

    it('returns 404 for nonexistent', async () => {
      const res = await request(app).get('/api/assets/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/assets/:id', () => {
    it('deletes an asset', async () => {
      const id = seedAsset(database);
      const res = await request(app).delete(`/api/assets/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
    });
  });
});
