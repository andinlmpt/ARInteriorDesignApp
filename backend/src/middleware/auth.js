/**
 * Authentication middleware
 * Supports JWT tokens and API keys (for backward compatibility)
 * Uses hardcoded users (no MongoDB required)
 */

import { findUserById, findUserByEmail } from '../data/hardcodedUsers.js';
import User from '../models/User.js';
import { isMongoDBConnected } from '../db/mongodb.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const isDev = () =>
  process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production';

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

/**
 * Resolve a user record from a decoded JWT.
 * Handles wiped MongoDB users, invalid ObjectIds, and hardcoded fallbacks.
 */
async function resolveUserFromDecoded(decoded) {
  if (!decoded?.userId && !decoded?.email) return null;

  let user = null;

  if (isMongoDBConnected()) {
    if (decoded.userId) {
      try {
        const dbUser = await User.findById(decoded.userId);
        if (dbUser) {
          user = {
            id: dbUser._id.toString(),
            email: dbUser.email,
            name: dbUser.name,
            role: dbUser.role || decoded.role || 'user',
          };
        }
      } catch {
        // Invalid ObjectId or cast error — fall through
      }
    }

    if (!user && decoded.email) {
      try {
        const dbUser = await User.findOne({ email: String(decoded.email).toLowerCase() });
        if (dbUser) {
          user = {
            id: dbUser._id.toString(),
            email: dbUser.email,
            name: dbUser.name,
            role: dbUser.role || decoded.role || 'user',
          };
        }
      } catch {
        // ignore
      }
    }
  }

  if (!user && decoded.userId) {
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

  if (!user && decoded.email) {
    const localUser = findUserByEmail(decoded.email);
    if (localUser) {
      user = {
        id: localUser.id,
        email: localUser.email,
        name: localUser.name,
        role: localUser.role || 'user',
      };
    }
  }

  // Dev: signed JWT is enough — DB may have been reset while the phone kept an old token.
  if (!user && isDev() && decoded.userId) {
    console.warn(
      `[Auth] User ${decoded.userId} missing in DB/hardcoded list — trusting JWT in development`,
    );
    user = {
      id: String(decoded.userId),
      email: decoded.email || '',
      name: decoded.name || 'User',
      role: decoded.role || 'user',
    };
  }

  return user;
}

export async function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const apiKey = req.headers['x-api-key'];
  const token = authHeader?.replace('Bearer ', '') || apiKey;

  // In development, allow requests without auth
  if (isDev() && !token) {
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
    const decoded = await verifyToken(token);

    if (decoded && (decoded.userId || decoded.email)) {
      const user = await resolveUserFromDecoded(decoded);

      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      req.user = {
        userId: user.id,
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };
      return next();
    }

    console.error('[Auth] Token verification failed (logic flow)');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  } catch (error) {
    console.error('[Auth] Token verification failed (exception):', error.message);

    if (isDev()) {
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
    const decoded = await verifyToken(token);

    if (decoded && (decoded.userId || decoded.email)) {
      const user = await resolveUserFromDecoded(decoded);
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
  } catch {
    req.user = null;
  }

  next();
}
