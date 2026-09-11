import express from 'express';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';
import { isMongoDBConnected, withMongoTimeout, ensureMongoConnection, isMongoConfigured } from '../db/mongodb.js';
import {
  findUserByEmail,
  findUserById,
  verifyPassword,
  createUser
} from '../data/hardcodedUsers.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const DB_UNAVAILABLE = {
  error: 'Service unavailable',
  message:
    'Could not reach the account database. Check your connection and try again in a moment.',
};

async function requireAuthStore() {
  if (!isMongoConfigured()) {
    return { mode: 'hardcoded' };
  }

  const ok = await ensureMongoConnection();
  if (!ok) {
    return { mode: 'unavailable' };
  }
  return { mode: 'mongo' };
}

// Simple JWT implementation (fallback if jsonwebtoken not available)
async function createToken(payload) {
  try {
    // Try to use jsonwebtoken if available
    const jwt = await import('jsonwebtoken');
    return jwt.default.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  } catch (error) {
    // Fallback: simple token generation
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payloadWithExp = { ...payload, exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) }; // 7 days
    const payloadEncoded = Buffer.from(JSON.stringify(payloadWithExp)).toString('base64url');
    const signature = Buffer.from(`${header}.${payloadEncoded}.${JWT_SECRET}`).toString('base64url');
    return `${header}.${payloadEncoded}.${signature}`;
  }
}

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
      // Check expiration
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
 * POST /api/v1/users/signup
 * Register a new user (using MongoDB when configured)
 */
router.post('/signup', async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Email and password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Password must be at least 6 characters',
      });
    }

    const store = await requireAuthStore();
    if (store.mode === 'unavailable') {
      return res.status(503).json(DB_UNAVAILABLE);
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    if (store.mode === 'mongo') {
      let existingUser;
      try {
        existingUser = await withMongoTimeout(
          User.findOne({ email: normalizedEmail }).exec(),
          8000,
          'Signup email lookup'
        );
      } catch (dbError) {
        console.error('[Signup] MongoDB lookup failed:', dbError.message);
        return res.status(503).json(DB_UNAVAILABLE);
      }

      if (existingUser) {
        return res.status(409).json({
          error: 'User already exists',
          message: 'An account with this email already exists',
        });
      }

      const user = new User({
        email: normalizedEmail,
        password,
        name: name || undefined,
      });

      try {
        await withMongoTimeout(user.save(), 10000, 'Signup user save');
      } catch (dbError) {
        if (dbError.code === 11000) {
          return res.status(409).json({
            error: 'User already exists',
            message: 'An account with this email already exists',
          });
        }
        console.error('[Signup] MongoDB save failed:', dbError.message);
        return res.status(503).json(DB_UNAVAILABLE);
      }

      const token = await createToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role || 'user',
      });

      return res.status(201).json({
        message: 'User created successfully',
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role || 'user',
          createdAt: user.createdAt,
        },
        token,
      });
    }

    // Hardcoded fallback only when Mongo is not configured
    const existingUser = findUserByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'An account with this email already exists',
      });
    }

    const user = createUser(normalizedEmail, password, name);
    const token = await createToken({ userId: user.id, email: user.email });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'An account with this email already exists',
      });
    }
    next(error);
  }
});

/**
 * POST /api/v1/users/login
 * Login user and get JWT token
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Email and password are required',
      });
    }

    const store = await requireAuthStore();
    if (store.mode === 'unavailable') {
      return res.status(503).json(DB_UNAVAILABLE);
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const candidatePassword = String(password);

    if (store.mode === 'mongo') {
      let user;
      try {
        user = await withMongoTimeout(
          User.findOne({ email: normalizedEmail })
            .select('+password')
            .maxTimeMS(5000)
            .exec(),
          8000,
          'Login user lookup'
        );
      } catch (dbError) {
        console.error('[Login] MongoDB lookup failed:', dbError.message);
        return res.status(503).json(DB_UNAVAILABLE);
      }

      if (!user) {
        console.warn(`[Login] No Mongo user for ${normalizedEmail}`);
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid email or password',
        });
      }

      const isPasswordValid = await user.comparePassword(candidatePassword);
      if (!isPasswordValid) {
        console.warn(`[Login] Bad password for Mongo user ${normalizedEmail}`);
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid email or password',
        });
      }

      const token = await createToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role || 'user',
      });

      return res.json({
        message: 'Login successful',
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role || 'user',
          createdAt: user.createdAt,
        },
        token,
      });
    }

    // Hardcoded fallback only when Mongo is not configured
    const user = findUserByEmail(normalizedEmail);

    if (!user) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password',
      });
    }

    const isPasswordValid = verifyPassword(user, candidatePassword);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password',
      });
    }

    const token = await createToken({ userId: user.id, email: user.email });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/users/:id
 * Update user profile
 */
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    const updateId = req.params.id;
    const updates = req.body;

    // Authorization check
    if (userId !== updateId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only update your own profile',
      });
    }

    // Validation: prevent updating sensitive fields directly via this endpoint
    const allowedUpdates = ['name', 'bio', 'phoneNumber', 'avatar', 'profilePicture', 'preferences', 'email', 'password'];
    const invalidUpdates = Object.keys(updates).filter(key => !allowedUpdates.includes(key));

    if (invalidUpdates.length > 0) {
      return res.status(400).json({
        error: 'Invalid updates',
        message: `Invalid fields: ${invalidUpdates.join(', ')}`,
      });
    }

    // Special validation for password if present
    if (updates.password && updates.password.length < 6) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Password must be at least 6 characters',
      });
    }

    // Use MongoDB if connected
    if (isMongoDBConnected()) {
      const user = await User.findById(userId).select('+profilePicture');

      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User does not exist',
        });
      }

      // Check email uniqueness if email is being updated
      if (updates.email && updates.email !== user.email) {
        const existingUser = await User.findOne({ email: updates.email.toLowerCase() });
        if (existingUser) {
          return res.status(409).json({
            error: 'Email in use',
            message: 'This email is already taken',
          });
        }
      }

      // Apply updates
      Object.keys(updates).forEach(key => {
        user[key] = updates[key];
      });

      await user.save();

      res.json({
        success: true,
        data: {
          user: {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            bio: user.bio,
            phoneNumber: user.phoneNumber,
            avatar: user.avatar,
            profilePicture: user.profilePicture || null,
            preferences: user.preferences,
            updatedAt: user.updatedAt,
          }
        }
      });
    } else {
      // Fallback for hardcoded users (in-memory update)
      const user = findUserById(userId);

      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User does not exist',
        });
      }

      // Simple in-memory update
      if (updates.name) user.name = updates.name;
      // Note: hardcodedUsers.js structure implies simple objects, may not have all new fields supported in fallback

      res.json({
        message: 'Profile updated successfully (In-Memory)',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/users/me
 * Get current user profile (using MongoDB)
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Use MongoDB if connected, otherwise fallback to hardcoded users
    if (isMongoDBConnected()) {
      // Get user from MongoDB
      const user = await User.findById(userId).select('+profilePicture');

      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User does not exist',
        });
      }

      res.json({
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        bio: user.bio,
        phoneNumber: user.phoneNumber,
        avatar: user.avatar,
        profilePicture: user.profilePicture || null,
        preferences: user.preferences,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    } else {
      // Fallback to hardcoded users if MongoDB is not connected
      const user = findUserById(userId);

      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User does not exist',
        });
      }

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      });
    }
  } catch (error) {
    next(error);
  }
});

export default router;

