/**
 * Idea Assistant Routes
 * API endpoints for AI-powered idea generation and prompt analysis
 */

import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import ideaController from '../controllers/ideaAssistantController.js';

const router = express.Router();

// Apply optional auth to all routes
router.use(optionalAuth);

/**
 * POST /api/v1/ideas/analyze
 * Analyze design prompt and extract suggestions
 * Body: { prompt, userPreferences }
 */
router.post('/analyze', ideaController.analyzePrompt);

/**
 * POST /api/v1/ideas/suggest
 * Generate design ideas
 * Body: { roomType, designStyle, dimensions, budget, userPrompt }
 */
router.post('/suggest', ideaController.generateIdeas);

/**
 * GET /api/v1/ideas/colors
 * Get color harmony suggestions
 * Query: primaryColor, style
 */
router.get('/colors', ideaController.suggestColorHarmony);

/**
 * GET /api/v1/ideas/fuse-styles
 * Fuse two design styles
 * Query: style1, style2
 */
router.get('/fuse-styles', ideaController.fuseStyles);

/**
 * GET /api/v1/ideas/status
 * Check service status
 */
router.get('/status', ideaController.checkStatus);

export default router;

