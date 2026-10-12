/**
 * Public furniture-store endpoints.
 */

import express from 'express';
import storeController from '../controllers/storeController.js';

const router = express.Router();

/** POST /api/v1/stores/register — creates a store account that waits for admin approval. */
router.post('/register', storeController.register);

export default router;
