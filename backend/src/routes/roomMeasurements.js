/**
 * Room measurement routes — saved AR scan dimensions.
 */

import express from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import roomMeasurementController from '../controllers/roomMeasurementController.js';

const router = express.Router();

/** POST /api/v1/room-measurements */
router.post('/', authenticate, roomMeasurementController.createMeasurement);

/** GET /api/v1/room-measurements */
router.get('/', authenticate, roomMeasurementController.getMeasurements);

/** GET /api/v1/room-measurements/:id */
router.get('/:id', optionalAuth, roomMeasurementController.getMeasurementById);

export default router;
