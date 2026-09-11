/**
 * Admin dashboard API routes
 */

import express from 'express';
import multer from 'multer';
import { authenticateStrict, requireAdmin } from '../middleware/requireAdmin.js';
import adminController from '../controllers/adminController.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

router.use(authenticateStrict, requireAdmin);

router.get('/me', adminController.getMe);
router.patch('/profile', adminController.updateProfile);
router.get('/stats', adminController.getStats);

router.get('/furniture', adminController.listFurniture);
router.get('/furniture/:id', adminController.getFurniture);
router.post('/furniture', adminController.createFurniture);
router.put('/furniture/:id', adminController.updateFurniture);
router.delete('/furniture/:id', adminController.deleteFurniture);

router.post('/upload/glb', upload.single('file'), adminController.uploadGlb);
router.post('/upload/thumbnail', upload.single('file'), adminController.uploadThumbnail);
router.post('/upload/avatar', upload.single('file'), adminController.uploadAvatar);

router.get('/users', adminController.listUsers);
router.patch('/users/:id', adminController.updateUser);

router.get('/store', adminController.getStore);
router.put('/store', adminController.updateStore);

export default router;
