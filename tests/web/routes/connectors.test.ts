import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import { createTestApp } from '../test-app.js';

describe('Connector API routes', () => {
  let app: express.Express;

  beforeAll(() => {
    ({ app } = createTestApp());
  });

  describe('GET /api/connectors', () => {
    it('returns array', async () => {
      const res = await request(app).get('/api/connectors');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/connectors', () => {
    it('registers a connector', async () => {
      const res = await request(app)
        .post('/api/connectors')
        .send({ name: 'Test KEV', connector_type: 'threat_feed', adapter_class: 'CISAKEVAdapter' });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });

    it('returns 400 without required fields', async () => {
      const res = await request(app).post('/api/connectors').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/connectors/adapters', () => {
    it('returns adapter list', async () => {
      const res = await request(app).get('/api/connectors/adapters');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toContain('CISAKEVAdapter');
    });
  });
});
