import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

const generateLayout = jest.fn();
const getLayout = jest.fn();
jest.unstable_mockModule('../../../src/controllers/layoutController.js', () => ({ generateLayout }));
jest.unstable_mockModule('../../../src/db/database.js', () => ({
  getDatabase: () => ({ prepare: () => ({ get: getLayout }) }),
}));
const { default: router } = await import('../../../src/routes/layouts.js');
const app = express();
app.use(express.json());
app.use('/api/v1/layouts', router);
app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));

beforeEach(() => {
  generateLayout.mockReset();
  getLayout.mockReset();
});

describe('Layouts API', () => {
  describe('GET /api/v1/layouts/:layoutId', () => {
    it('returns only layouts owned by the requester', async () => {
      getLayout.mockReturnValue({ id: 'owned', user_id: 'dev-user', layout_data: '{"furniture":[]}' });
      const response = await request(app).get('/api/v1/layouts/owned').expect(200);
      expect(response.body.layout_data).toEqual({ furniture: [] });
      getLayout.mockReturnValue({ id: 'private', user_id: 'someone-else', layout_data: '{}' });
      await request(app).get('/api/v1/layouts/private').expect(403);
    });
    it('reports missing layouts', async () => {
      await request(app).get('/api/v1/layouts/missing').expect(404);
    });
  });

  describe('POST /api/v1/layouts/generate', () => {
    it('should create a new layout with valid data', async () => {
      const layoutData = {
        constraints: { room_dimensions: {
          width: 5,
          length: 4,
          height: 2.5,
        } },
      };

      generateLayout.mockResolvedValue({ layouts: [{ id: 'test-layout' }] });
      const response = await request(app)
        .post('/api/v1/layouts/generate')
        .send(layoutData)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.layouts[0].id).toBe('test-layout');
      expect(generateLayout).toHaveBeenCalledWith(layoutData, expect.objectContaining({ id: 'dev-user' }));
    });

    it('should return 400 with invalid data', async () => {
      const invalidData = {
        name: '', // Invalid: empty name
      };

      await request(app)
        .post('/api/v1/layouts/generate')
        .send(invalidData)
        .expect(400);
      expect(generateLayout).not.toHaveBeenCalled();
    });
    it('propagates generation failures instead of hanging the request', async () => {
      generateLayout.mockRejectedValue(new Error('Layout generation failed'));
      await request(app).post('/api/v1/layouts/generate')
        .send({ constraints: { room_dimensions: { width: 5, length: 4, height: 2.5 } } }).expect(500);
    });
  });
});
