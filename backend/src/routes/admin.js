/**
 * Admin console API — store review, product oversight/moderation, users, activity log, app content.
 */

import express from 'express';
import { authenticateStrict, requireAdmin } from '../middleware/requireAdmin.js';
import adminController from '../controllers/adminController.js';
import contentController from '../controllers/contentController.js';

const router = express.Router();

router.use(authenticateStrict, requireAdmin);

router.get('/stats', adminController.getStats);

router.get('/stores', adminController.listStores);
router.patch('/stores/:id/status', adminController.updateStoreStatus);

router.get('/furniture', adminController.listFurniture);
router.post('/furniture/assign-unassigned', adminController.assignUnassignedFurniture);
router.patch('/furniture/:id/moderation', adminController.moderateFurniture);
router.patch('/furniture/:id/store', adminController.assignFurnitureStore);

router.get('/users', adminController.listUsers);
router.patch('/users/:id', adminController.updateUser);

router.get('/activity', adminController.listActivity);

router.put('/content/faqs', contentController.updateFaqs);
router.put('/content/legal/:key', contentController.updateLegal);

export default router;
