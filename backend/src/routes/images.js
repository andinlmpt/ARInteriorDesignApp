/**
 * Image Generation Routes
 * API endpoints for AI image generation (OpenAI DALL-E proxy)
 */

import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import imageController from '../controllers/imageGenerationController.js';

const router = express.Router();

// Apply optional auth to all routes
router.use(optionalAuth);

/**
 * POST /api/v1/images/generate
 * Generate design image using DALL-E
 * Body: { proposal, preferences }
 */
router.post('/generate', imageController.generateDesignImage);

/**
 * GET /api/v1/images/status
 * Check if image generation service is available
 */
router.get('/status', imageController.checkServiceStatus);

/**
 * POST /api/v1/images/preview-prompt
 * Preview the generated prompt (for debugging)
 * Body: { proposal, preferences }
 */
router.post('/preview-prompt', imageController.previewPrompt);

export default router;

