import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// The sessions a query finds: [finalized, latest]. Each findOne call takes the next one.
let found = [];
const findOne = jest.fn(() => {
  const result = found.shift() ?? null;
  const query = { sort: () => query, select: () => query, lean: async () => result };
  return query;
});
const findById = jest.fn();
// The sessions GET /projects reads, newest first.
let listed = [];
const find = jest.fn(() => {
  const query = { sort: () => query, limit: () => query, select: () => query, lean: async () => listed };
  return query;
});
const updateMany = jest.fn(async () => ({ modifiedCount: 2 }));
jest.unstable_mockModule('../../../src/models/DesignSession.js', () => ({
  default: { findOne, findById, find, updateMany },
}));
jest.unstable_mockModule('../../../src/middleware/auth.js', () => ({
  optionalAuth: (req, _res, next) => {
    const user = req.get('x-test-user');
    if (user) req.user = { userId: user };
    next();
  },
}));
// Catalog for POST /room-fit (sizes in metres; modelSize wins over the listed size, as in layouts).
let catalog = [];
jest.unstable_mockModule('../../../src/models/Furniture.js', () => ({
  default: { find: jest.fn(() => ({ lean: async () => catalog })) },
}));
jest.unstable_mockModule('../../../src/services/catalogVisibility.js', () => ({
  withPublicVisibility: async (filter) => filter,
}));
const { default: router } = await import('../../../src/routes/designs.js');
const app = express();
app.use(express.json());
app.use('/api/v1/designs', router);
app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));

const OWNER = '6ac9d2c7641a524d3012c0aa';

beforeEach(() => {
  found = [];
  findOne.mockClear();
  findById.mockReset();
});

describe('GET /api/v1/designs/project/:projectId', () => {
  it('opens the saved design of the project, for its owner only', async () => {
    found = [{ _id: 'saved-session', finalLayout: { items: [{}], updatedAt: new Date(2026, 9, 24) } }];
    const response = await request(app)
      .get('/api/v1/designs/project/project-1')
      .set('x-test-user', OWNER)
      .expect(200);
    expect(response.body).toMatchObject({ sessionId: 'saved-session', finalized: true });
    expect(findOne.mock.calls[0][0]).toMatchObject({ projectId: 'project-1', userId: OWNER });
    expect(findById).not.toHaveBeenCalled();
  });

  it('falls back to the newest generated design when none was saved', async () => {
    found = [null, { _id: 'generated-session', createdAt: new Date(2026, 9, 27) }];
    const response = await request(app)
      .get('/api/v1/designs/project/project-1')
      .set('x-test-user', OWNER)
      .expect(200);
    expect(response.body).toMatchObject({ sessionId: 'generated-session', finalized: false });
  });

  it('reports a project with no design yet', async () => {
    found = [null, null];
    await request(app).get('/api/v1/designs/project/new-project').set('x-test-user', OWNER).expect(404);
  });
});

describe('GET /api/v1/designs/projects', () => {
  const session = (projectId, day, extra = {}) => ({
    projectId,
    createdAt: new Date(2026, 9, day),
    preferences: { roomType: 'Bedroom', style: 'Modern' },
    ...extra,
  });

  it('lists each project once, by its saved design when it has one', async () => {
    listed = [
      session('project-a', 28),
      session('project-a', 27, {
        finalLayout: { title: 'My bedroom', items: [{ instanceId: 'bed' }], updatedAt: new Date(2026, 9, 27) },
      }),
      session('project-b', 26),
    ];
    const response = await request(app).get('/api/v1/designs/projects').set('x-test-user', OWNER).expect(200);
    expect(response.body.projects.map((p) => p.projectId)).toEqual(['project-a', 'project-b']);
    expect(response.body.projects[0]).toMatchObject({ finalized: true, title: 'My bedroom', roomType: 'Bedroom' });
    expect(response.body.projects[1]).toMatchObject({ finalized: false, title: '' });
    expect(find.mock.calls.at(-1)[0]).toMatchObject({ userId: OWNER, projectDeletedAt: null });
  });

  it('gives nothing without a signed-in user', async () => {
    const response = await request(app).get('/api/v1/designs/projects').expect(200);
    expect(response.body.projects).toEqual([]);
  });
});

describe('DELETE /api/v1/designs/project/:projectId', () => {
  it('hides the project for its owner only, and erases nothing', async () => {
    updateMany.mockClear();
    const response = await request(app).delete('/api/v1/designs/project/project-a').set('x-test-user', OWNER).expect(200);
    expect(response.body).toMatchObject({ success: true, hidden: 2 });
    expect(updateMany.mock.calls[0][0]).toEqual({ projectId: 'project-a', userId: OWNER });
    expect(updateMany.mock.calls[0][1].$set.projectDeletedAt).toBeInstanceOf(Date);
  });

  it('does nothing without a signed-in user', async () => {
    updateMany.mockClear();
    await request(app).delete('/api/v1/designs/project/project-a').expect(200);
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/designs/room-fit', () => {
  const product = (id, width, depth, height, extra = {}) => ({
    id, displayName: id, category: 'sofa', width, depth, height, pricePhp: 1000, ...extra,
  });

  it('lists the catalog pieces that cannot fit the scanned room, and why', async () => {
    catalog = [
      product('love-seat', 1.5, 0.7, 0.8),
      product('sectional', 1.8, 0.9, 0.8, { modelSize: { width: 2.6, depth: 2.6, height: 0.8 } }),
      product('tall-cabinet', 0.8, 0.4, 2.6, { category: 'cabinet' }),
      product('wide-sofa', 2.2, 0.9, 0.85),
    ];
    // 2.4 × 2.4 m room, 2.5 m high, with a 1.6 m deep table along one side: 0.75 m of
    // floor stays free past it (5 cm off the wall), room for the love seat but not the 0.9 m deep sofa.
    const floorPolygon = [{ x: 0, z: 0 }, { x: 2.4, z: 0 }, { x: 2.4, z: 2.4 }, { x: 0, z: 2.4 }];
    const obstacles = [{ id: 'table', type: 'table', center: { x: 1.2, y: 0.4, z: 0.8 }, size: { x: 2.4, y: 0.75, z: 1.6 }, yaw: 0 }];
    const response = await request(app)
      .post('/api/v1/designs/room-fit')
      .send({ dimensions: { width: 2.4, length: 2.4, height: 2.5 }, floorPolygon, obstacles })
      .expect(200);
    expect(response.body.checked).toBe(4);
    expect(response.body.existingCount).toBe(1);
    expect(response.body.unfit).toEqual(expect.arrayContaining([
      { id: 'sectional', reason: 'too-big' },
      { id: 'tall-cabinet', reason: 'too-tall' },
      { id: 'wide-sofa', reason: 'no-space' },
    ]));
    expect(response.body.unfit.map((u) => u.id)).not.toContain('love-seat');
  });

  it('rejects a room size that makes no sense', async () => {
    await request(app).post('/api/v1/designs/room-fit').send({ dimensions: { width: 80, length: 3, height: 2.5 } }).expect(400);
  });
});
