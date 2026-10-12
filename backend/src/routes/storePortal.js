/**
 * Store portal API for the signed-in furniture store: its profile and its own products.
 * Product changes require an approved store; suspended stores are read-only.
 */

import express from 'express';
import { authenticateStrict } from '../middleware/requireAdmin.js';
import { rejectSuspendedStore, requireApprovedStore, requireStore } from '../middleware/requireStore.js';
import { fileUpload, modelFileUpload } from '../middleware/upload.js';
import storeController from '../controllers/storeController.js';

const router = express.Router();

router.use(authenticateStrict, requireStore);

router.get('/me', storeController.getMe);
router.put('/profile', rejectSuspendedStore, storeController.updateProfile);
router.post('/resubmit', storeController.resubmit);
router.get('/stats', storeController.getStats);

router.get('/products', storeController.listProducts);
router.get('/products/:id', storeController.getProduct);
router.post('/products', requireApprovedStore, storeController.createProduct);
router.put('/products/:id', requireApprovedStore, storeController.updateProduct);
router.delete('/products/:id', requireApprovedStore, storeController.deleteProduct);

router.post('/upload/glb', requireApprovedStore, modelFileUpload, storeController.uploadGlb);
router.post('/upload/image', rejectSuspendedStore, fileUpload.single('file'), storeController.uploadImage);

export default router;
