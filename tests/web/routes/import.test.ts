import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type express from 'express';
import { createTestApp } from '../test-app.js';

describe('Import API routes', () => {
  let app: express.Express;

  beforeAll(() => {
    ({ app } = createTestApp());
  });

  describe('GET /api/import/formats', () => {
    it('returns format list with size limit', async () => {
      const res = await request(app).get('/api/import/formats');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('max_file_size_mb');
      expect(res.body).toHaveProperty('allowed_extensions');
      expect(res.body).toHaveProperty('formats');
      expect(Array.isArray(res.body.formats)).toBe(true);
      expect(res.body.formats.length).toBe(4);
    });
  });

  describe('POST /api/import/preview', () => {
    it('returns 400 without file', async () => {
      const res = await request(app).post('/api/import/preview');
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/import/confirm', () => {
    it('returns 400 without required fields', async () => {
      const res = await request(app).post('/api/import/confirm').send({});
      expect(res.status).toBe(400);
    });

    it('rejects path traversal', async () => {
      const res = await request(app).post('/api/import/confirm').send({
        upload_path: '/etc/passwd',
        original_name: 'test.csv',
      });
      expect(res.status).toBe(400);
    });
  });
});
