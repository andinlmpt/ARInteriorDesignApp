/**
 * Signed-in console account (admin or store): profile name and photo.
 */

import express from 'express';
import { authenticateStrict, requireRole } from '../middleware/requireAdmin.js';
import { fileUpload } from '../middleware/upload.js';
import accountController from '../controllers/accountController.js';

const router = express.Router();

router.use(authenticateStrict, requireRole('admin', 'store'));

router.get('/me', accountController.getMe);
router.patch('/profile', accountController.updateProfile);
router.post('/upload/avatar', fileUpload.single('file'), accountController.uploadAvatar);

export default router;
