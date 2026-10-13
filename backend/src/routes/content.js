/**
 * Public app content for the mobile app (FAQs and legal pages). Admins edit it under /admin/content.
 */

import express from 'express';
import contentController from '../controllers/contentController.js';

const router = express.Router();

router.get('/faqs', contentController.getFaqs);
router.get('/legal', contentController.getLegal);

export default router;
