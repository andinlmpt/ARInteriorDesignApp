/**
 * Furniture catalog routes
 */

import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import furnitureController from '../controllers/furnitureController.js';

const router = express.Router();

router.use(optionalAuth);

/** GET /api/v1/furniture?category=seating */
router.get('/', furnitureController.getAllFurniture);

/** GET /api/v1/furniture/:id */
router.get('/:id', furnitureController.getFurnitureById);

export default router;
