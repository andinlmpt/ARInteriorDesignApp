import { afterEach, describe, expect, it, jest } from '@jest/globals';
import DesignSession from '../../src/models/DesignSession.js';
import { finalizeDesign, getDesignSession } from '../../src/controllers/aiDesignController.js';

const owner = '507f1f77bcf86cd799439011';
const other = '507f1f77bcf86cd799439012';
const payload = () => ({ proposalId: 'proposal', room: { width: 4, length: 5, height: 2.7 },
  items: [{ furnitureId: 'chair', pricePhp: 2500 }, { furnitureId: 'desk', pricePhp: 6000 }], totalPhp: 1 });
function response() { return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }; }
afterEach(() => jest.restoreAllMocks());

describe('Final design persistence', () => {
  it('recomputes the estimate after furniture changes instead of trusting a stale total', async () => {
    jest.spyOn(DesignSession.prototype, 'save').mockImplementation(async function () { return this; });
    const res = response();
    const next = jest.fn();
    await finalizeDesign({ body: payload(), user: { id: owner } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].finalLayout.totalPhp).toBe(8500);
  });

  it.each([
    body => { body.room.width = -1; },
    body => { body.room.height = Infinity; },
    body => { body.items[0].pricePhp = -2500; },
    body => { body.items[0].pricePhp = 'invalid'; },
  ])('rejects invalid dimensions or prices before saving', async change => {
    const body = payload();
    change(body);
    const save = jest.spyOn(DesignSession.prototype, 'save');
    const res = response();
    await finalizeDesign({ body }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(save).not.toHaveBeenCalled();
  });

  it('prevents overwriting another user’s design', async () => {
    jest.spyOn(DesignSession, 'findById').mockResolvedValue({ userId: owner });
    const res = response();
    await finalizeDesign({ body: { ...payload(), sessionId: owner }, user: { id: other } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('prevents reading another user’s design', async () => {
    jest.spyOn(DesignSession, 'findById').mockReturnValue({ lean: async () => ({ userId: owner }) });
    const res = response();
    await getDesignSession({ params: { id: owner }, user: { id: other } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
