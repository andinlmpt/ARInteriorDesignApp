/**
 * Saved items routes — Saved tab favorites stored in MongoDB.
 */

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import savedItemController from '../controllers/savedItemController.js';

const router = express.Router();

/** GET /api/v1/saved-items */
router.get('/', authenticate, savedItemController.listItems);

/** GET /api/v1/saved-items/stats */
router.get('/stats', authenticate, savedItemController.getStats);

/** POST /api/v1/saved-items/bulk-delete */
router.post('/bulk-delete', authenticate, savedItemController.bulkDelete);

/** DELETE /api/v1/saved-items (clear all for user) */
router.delete('/', authenticate, savedItemController.clearAll);

/** GET /api/v1/saved-items/:itemId */
router.get('/:itemId', authenticate, savedItemController.getItemById);

/** POST /api/v1/saved-items (create or update) */
router.post('/', authenticate, savedItemController.upsertItem);

/** DELETE /api/v1/saved-items/:itemId */
router.delete('/:itemId', authenticate, savedItemController.deleteItem);

export default router;
