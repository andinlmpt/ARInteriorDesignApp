import './loadEnv.js';

import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import routes
import layoutRoutes from './routes/layouts.js';
import projectRoutes from './routes/projects.js';
import userRoutes from './routes/users.js';
import imageRoutes from './routes/images.js';
import designRoutes from './routes/designs.js';
import ideaRoutes from './routes/ideas.js';
import trainingRoutes from './routes/training.js';
import furnitureRoutes from './routes/furniture.js';
import adminRoutes from './routes/admin.js';
import accountRoutes from './routes/account.js';
import storeRoutes from './routes/stores.js';
import storePortalRoutes from './routes/storePortal.js';
import contentRoutes from './routes/content.js';
import roomMeasurementRoutes from './routes/roomMeasurements.js';
import savedItemRoutes from './routes/savedItems.js';
import { UPLOAD_ROOT } from './services/uploadService.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/logger.js';
import { initDatabase } from './db/database.js';
import { connectMongoDB, disconnectMongoDB } from './db/mongodb.js';
import {
  initSentry,
  sentryRequestHandler,
  sentryTracingHandler,
  sentryErrorHandler
} from './middleware/sentry.js';

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Sentry request handler (must be first)
app.use(sentryRequestHandler());
app.use(sentryTracingHandler());

// Security middleware
app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
  // Allow admin (5173) and mobile clients to display /uploads images.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:8081',
    'http://localhost:19006',
    'http://localhost:5173',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API responses must not be cached by browsers/proxies (admin list was returning 304
// with stale quantity after successful product updates).
app.set('etag', false);
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Compression
app.use(compression());

// Logging
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

app.use(requestLogger);

// Rate limiting per IP. RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MINUTES in .env can raise it
// (e.g. while bulk-uploading products); defaults are 100 requests per 15 minutes.
const limiter = rateLimit({
  windowMs: (Number(process.env.RATE_LIMIT_WINDOW_MINUTES) || 15) * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Serve static files (web view)
const publicPath = join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// Uploaded furniture assets (GLB + thumbnails)
app.use('/uploads', express.static(UPLOAD_ROOT));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
  });
});

// API routes
app.use('/api/v1/layouts', layoutRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/images', imageRoutes);
app.use('/api/v1/designs', designRoutes);
app.use('/api/v1/ideas', ideaRoutes);
app.use('/api/v1/training', trainingRoutes);
app.use('/api/v1/furniture', furnitureRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/account', accountRoutes);
app.use('/api/v1/stores', storeRoutes);
app.use('/api/v1/store', storePortalRoutes);
app.use('/api/v1/content', contentRoutes);
app.use('/api/v1/room-measurements', roomMeasurementRoutes);
app.use('/api/v1/saved-items', savedItemRoutes);

// Root endpoint - serve web view
app.get('/', (req, res) => {
  res.sendFile(join(publicPath, 'index.html'));
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'AR Interior Design API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      layouts: '/api/v1/layouts',
      projects: '/api/v1/projects',
      users: '/api/v1/users',
      images: '/api/v1/images',
      designs: '/api/v1/designs',
      ideas: '/api/v1/ideas',
      training: '/api/v1/training',
      furniture: '/api/v1/furniture',
      admin: '/api/v1/admin',
      account: '/api/v1/account',
      stores: '/api/v1/stores',
      storePortal: '/api/v1/store',
      content: '/api/v1/content',
      roomMeasurements: '/api/v1/room-measurements',
      savedItems: '/api/v1/saved-items',
    },
    webView: '/',
  });
});

// Error handling middleware (must be last)
// Sentry error handler must come before other error handlers
app.use(sentryErrorHandler());
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize databases
const db = initDatabase(); // In-memory database (for backward compatibility)

// Initialize Sentry and start server
// Importing the app for tests must not open a listener or a database connection.
if (process.argv[1] && resolve(process.argv[1]) === __filename && NODE_ENV !== 'test') {
(async () => {
  await initSentry();

  // Connect to MongoDB
  try {
    await connectMongoDB();
  } catch (error) {
    console.error('[Server] Failed to connect to MongoDB:', error.message);
    console.warn('[Server] Continuing without MongoDB connection...');
  }

  // Start server — bind to 0.0.0.0 so physical devices on the LAN can reach it
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Environment: ${NODE_ENV}`);
    console.log(`🌐 Web View: http://localhost:${PORT}/`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📚 API base: http://localhost:${PORT}/api/v1`);
  });

  server.on('error', async (error) => {
    if (error.code === 'EADDRINUSE') {
      console.warn(`\n⚠️  Port ${PORT} is already in use.`);
      try {
        const healthRes = await fetch(`http://127.0.0.1:${PORT}/health`);
        if (healthRes.ok) {
          const health = await healthRes.json();
          console.log('✅ Backend is already running — no need to start another instance.');
          console.log(`   Health: ${JSON.stringify(health)}`);
          console.log(`   API base: http://localhost:${PORT}/api/v1`);
          console.log('   To restart, stop the existing process first:');
          console.log(`     netstat -ano | findstr :${PORT}`);
          console.log('     taskkill /PID <pid> /F\n');
          process.exit(0);
        }
      } catch {
        // health check failed — port is held by something else
      }
      console.error(`❌ Port ${PORT} is in use by another process.`);
      console.error('   Stop it with: netstat -ano | findstr :' + PORT);
      console.error('   Then: taskkill /PID <pid> /F\n');
      process.exit(1);
    }
    throw error;
  });

  // Graceful shutdown handler
  const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Closing server gracefully...`);

    server.close(async () => {
      console.log('HTTP server closed');

      // Close in-memory database connection
      if (db) {
        try {
          db.close();
          console.log('In-memory database connection closed');
        } catch (error) {
          console.error('Error closing in-memory database:', error);
        }
      }

      // Close MongoDB connection
      try {
        await disconnectMongoDB();
        console.log('MongoDB connection closed');
      } catch (error) {
        console.error('Error closing MongoDB:', error);
      }

      console.log('Graceful shutdown complete');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  };

  // Register shutdown handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
})();
}

export default app;


