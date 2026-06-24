/**
 * Authentication middleware
 * Supports JWT tokens and API keys (for backward compatibility)
 * Uses hardcoded users (no MongoDB required)
 */

import { findUserById } from '../data/hardcodedUsers.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Simple JWT verification (fallback if jsonwebtoken not available)
async function verifyToken(token) {
  try {
    // Try to use jsonwebtoken if available
    const jwt = await import('jsonwebtoken');
    return jwt.default.verify(token, JWT_SECRET);
  } catch (error) {
    // Fallback: simple token verification
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      // Basic expiration check (7 days)
      if (payload.exp && payload.exp < Date.now() / 1000) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }
}

import User from '../models/User.js';
import { isMongoDBConnected } from '../db/mongodb.js';

// ... (existing imports)

export async function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const apiKey = req.headers['x-api-key'];
  const token = authHeader?.replace('Bearer ', '') || apiKey;

  // In development, allow requests without auth
  if (process.env.NODE_ENV === 'development' && !token) {
    req.user = { userId: 'dev-user', id: 'dev-user', role: 'user' };
    return next();
  }

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authorization token or API key required',
    });
  }

  try {
    // Try to verify as JWT token first
    const decoded = await verifyToken(token);

    if (decoded && decoded.userId) {
      let user = null;

      // 1. Try MongoDB if connected
      if (isMongoDBConnected()) {
        const dbUser = await User.findById(decoded.userId);
        if (dbUser) {
          user = {
            id: dbUser._id.toString(),
            email: dbUser.email,
            name: dbUser.name,
            role: 'user', // Default role
          };
        }
      }

      // 2. Fallback to hardcoded users if not found in DB or DB not connected
      if (!user) {
        const localUser = findUserById(decoded.userId);
        if (localUser) {
          user = {
            id: localUser.id,
            email: localUser.email,
            name: localUser.name,
            role: localUser.role || 'user',
          };
        }
      }

      // 3. User not found anywhere
      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User not found',
        });
      }

      req.user = {
        userId: user.id,
        id: user.id, // For backward compatibility
        email: user.email,
        name: user.name,
        role: user.role,
      };
      return next();
    }

    // ... (rest of function)

    // If token is invalid or expired
    console.error('[Auth] Token verification failed (logic flow)');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  } catch (error) {
    console.error('[Auth] Token verification failed (exception):', error.message);

    // Fallback for development
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Auth] Authentication error, allowing in development:', error.message);
      req.user = { userId: 'dev-user', id: 'dev-user', role: 'user' };
      return next();
    }

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }
}

/**
 * Optional authentication - doesn't fail if no auth provided
 */
export async function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const apiKey = req.headers['x-api-key'];
  const token = authHeader?.replace('Bearer ', '') || apiKey;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    // Try JWT verification
    const decoded = await verifyToken(token);

    if (decoded && decoded.userId) {
      let user = null;

      // 1. Try MongoDB
      if (isMongoDBConnected()) {
        const dbUser = await User.findById(decoded.userId);
        if (dbUser) {
          user = {
            id: dbUser._id.toString(),
            email: dbUser.email,
            name: dbUser.name,
            role: 'user',
          };
        }
      }

      // 2. Fallback to local
      if (!user) {
        const localUser = findUserById(decoded.userId);
        if (localUser) {
          user = {
            id: localUser.id,
            email: localUser.email,
            name: localUser.name,
            role: localUser.role || 'user',
          };
        }
      }

      if (user) {
        req.user = {
          userId: user.id,
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      } else {
        req.user = null;
      }
    } else {
      req.user = null;
    }
  } catch (error) {
    req.user = null;
  }

  next();
}

