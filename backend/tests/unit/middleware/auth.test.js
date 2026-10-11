import { beforeAll, afterAll, describe, expect, it, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

const secret = 'auth-regression-test-secret';
const previousSecret = process.env.JWT_SECRET;
const previousEnv = process.env.NODE_ENV;
let authenticate;
let optionalAuth;

beforeAll(async () => {
  process.env.JWT_SECRET = secret;
  process.env.NODE_ENV = 'test';
  ({ authenticate, optionalAuth } = await import('../../../src/middleware/auth.js'));
});
afterAll(() => {
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
  process.env.NODE_ENV = previousEnv;
});

function response() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

describe('JWT authentication', () => {
  it.each([
    ['forged signature', () => jwt.sign({ userId: 'test-user', role: 'admin' }, 'wrong-secret')],
    ['expired token', () => jwt.sign({ userId: 'test-user' }, secret, { expiresIn: -1 })],
    ['unsigned token', () => jwt.sign({ userId: 'test-user' }, '', { algorithm: 'none' })],
  ])('rejects a %s instead of trusting decoded claims', async (_label, makeToken) => {
    const req = { headers: { authorization: `Bearer ${makeToken()}` } };
    const res = response();
    const next = jest.fn();
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('accepts a verified development identity when the local account was reset', async () => {
    const req = { headers: { authorization: `Bearer ${jwt.sign({ userId: 'test-user' }, secret)}` } };
    const next = jest.fn();
    await authenticate(req, response(), next);
    expect(req.user.id).toBe('test-user');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('keeps optional authentication anonymous for invalid tokens', async () => {
    const req = { headers: { authorization: `Bearer ${jwt.sign({ userId: 'test-user' }, 'wrong-secret')}` } };
    const next = jest.fn();
    await optionalAuth(req, response(), next);
    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects production requests when a signing secret is missing', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    try {
      const req = { headers: { authorization: `Bearer ${jwt.sign({ userId: 'test-user' }, secret)}` } };
      const res = response();
      const next = jest.fn();
      await authenticate(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = 'test';
      process.env.JWT_SECRET = secret;
    }
  });
});
