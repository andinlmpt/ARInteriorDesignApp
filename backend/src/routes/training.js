/**
 * AI Training Routes
 * API endpoints for ML model training and predictions
 */

import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import trainingController from '../controllers/aiTrainingController.js';

const router = express.Router();

// Apply optional auth to all routes
router.use(optionalAuth);

/**
 * POST /api/v1/training/train
 * Train model from user data
 * Body: { usagePatterns, likedDesigns, appliedDesigns }
 */
router.post('/train', trainingController.trainFromUserData);

/**
 * GET /api/v1/training/predict/style
 * Predict style based on context
 * Query: roomType, budget, prompt
 */
router.get('/predict/style', trainingController.predictStyle);

/**
 * GET /api/v1/training/predict/room
 * Predict room based on context
 * Query: style, prompt
 */
router.get('/predict/room', trainingController.predictRoom);

/**
 * GET /api/v1/training/predict/colors
 * Predict colors based on style and budget
 * Query: style, budget
 */
router.get('/predict/colors', trainingController.predictColors);

/**
 * GET /api/v1/training/optimization-goal
 * Get optimization goal recommendation
 * Query: roomType, style
 */
router.get('/optimization-goal', trainingController.getOptimizationGoal);

/**
 * GET /api/v1/training/stats
 * Get training statistics
 */
router.get('/stats', trainingController.getTrainingStats);

/**
 * POST /api/v1/training/refine
 * Refine model based on success rate
 */
router.post('/refine', trainingController.refineModel);

/**
 * POST /api/v1/training/reset
 * Reset training data
 */
router.post('/reset', trainingController.resetTraining);

export default router;

