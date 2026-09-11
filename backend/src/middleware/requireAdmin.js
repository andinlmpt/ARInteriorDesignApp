/**
 * Admin-only route protection — always requires a valid JWT with role admin.
 */

import User from '../models/User.js';
import { isMongoDBConnected } from '../db/mongodb.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

async function verifyToken(token) {
  try {
    const jwt = await import('jsonwebtoken');
    return jwt.default.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export async function authenticateStrict(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authorization token required',
    });
  }

  try {
    const decoded = await verifyToken(token);

    if (!decoded?.userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }

    if (!isMongoDBConnected()) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Admin dashboard requires MongoDB.',
      });
    }

    const dbUser = await User.findById(decoded.userId);
    if (!dbUser) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found',
      });
    }

    req.user = {
      userId: dbUser._id.toString(),
      id: dbUser._id.toString(),
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role || 'user',
    };

    next();
  } catch (error) {
    console.error('[AuthStrict] Token verification failed:', error.message);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required',
    });
  }
  next();
}
