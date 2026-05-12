/**
 * Theme Routes
 * API endpoints for theme recommendations
 * IMPROVED: Added validation middleware
 */

import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { validateThemeRecommendationRequest, validateThemeFeedbackRequest } from '../middleware/validation.js';
import themeController from '../controllers/themeController.js';

const router = express.Router();

// Apply optional auth to all routes
router.use(optionalAuth);

/**
 * GET /api/v1/themes/recommendations
 * Get AI-powered theme recommendations
 * Query params: room_type, mood, style, budget, colors, user_history
 * 
 * @example
 * GET /api/v1/themes/recommendations?room_type=Living%20Room&mood=Cozy&style=Modern&budget=medium
 */
router.get('/recommendations', validateThemeRecommendationRequest, themeController.getThemeRecommendations);

/**
 * POST /api/v1/themes/feedback
 * Record user feedback (like, dislike, apply)
 * Body: { themeId, action, timestamp }
 * 
 * @example
 * POST /api/v1/themes/feedback
 * { "themeId": "modern-minimalist-white", "action": "like", "timestamp": 1234567890 }
 */
router.post('/feedback', validateThemeFeedbackRequest, themeController.recordFeedback);

/**
 * GET /api/v1/themes
 * Get all available themes
 */
router.get('/', themeController.getAllThemes);

/**
 * GET /api/v1/themes/:id
 * Get theme by ID
 */
router.get('/:id', themeController.getThemeById);

export default router;
