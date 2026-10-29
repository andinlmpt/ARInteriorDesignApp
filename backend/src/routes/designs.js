/**
 * AI Design Routes
 * API endpoints for AI-powered design generation
 */

import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import aiDesignController from '../controllers/aiDesignController.js';

const router = express.Router();

// Apply optional auth to all routes
router.use(optionalAuth);

/**
 * POST /api/v1/designs/generate
 * Generate 2–3 AI design proposals
 * Body: { roomType, dimensions, designStyle, budgetPhp, requiredItemIds, measurementId, ... }
 */
router.post('/generate', aiDesignController.generateDesign);

/**
 * POST /api/v1/designs/room-fit
 * Catalog pieces that can't fit the scanned room (left out of the recommended furniture).
 * Body: { dimensions, measurementId?, floorPolygon?, openings?, obstacles? }
 */
router.post('/room-fit', aiDesignController.roomFit);

/**
 * POST /api/v1/designs/finalize
 * Persist the user's customized layout (design flow step 7).
 */
router.post('/finalize', aiDesignController.finalizeDesign);

/**
 * GET /api/v1/designs/furniture/:roomType
 * Get furniture catalog for a room type
 */
router.get('/furniture/:roomType', aiDesignController.getFurnitureCatalog);

/**
 * GET /api/v1/designs/project/:projectId
 * The project's newest design (a saved one first), so a saved project reopens its design.
 * Declared before /:id, which would otherwise take "project" as a session id.
 */
router.get('/project/:projectId', aiDesignController.getLatestProjectSession);

/**
 * GET /api/v1/designs/:id
 * Load a persisted design session
 */
router.get('/:id', aiDesignController.getDesignSession);

/**
 * POST /api/v1/designs/estimate-cost
 * Estimate cost for furniture list
 * Body: { furniture, budget }
 */
router.post('/estimate-cost', aiDesignController.estimateFurnitureCost);

export default router;

