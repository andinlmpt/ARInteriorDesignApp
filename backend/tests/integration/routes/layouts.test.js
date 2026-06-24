import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../../src/server.js';

describe('Layouts API', () => {
  describe('GET /api/v1/layouts', () => {
    it('should return 200 and list of layouts', async () => {
      const response = await request(app)
        .get('/api/v1/layouts')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/v1/layouts', () => {
    it('should create a new layout with valid data', async () => {
      const layoutData = {
        name: 'Test Layout',
        roomType: 'Living Room',
        dimensions: {
          width: 5,
          length: 4,
          height: 2.5,
        },
        furniture: [],
      };

      const response = await request(app)
        .post('/api/v1/layouts')
        .send(layoutData)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.name).toBe(layoutData.name);
    });

    it('should return 400 with invalid data', async () => {
      const invalidData = {
        name: '', // Invalid: empty name
      };

      await request(app)
        .post('/api/v1/layouts')
        .send(invalidData)
        .expect(400);
    });
  });
});
