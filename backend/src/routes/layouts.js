import express from 'express';
import { generateLayout } from '../controllers/layoutController.js';
import { validateLayoutRequest } from '../middleware/validation.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/v1/layouts/generate
 * Generate interior design layouts based on preferences
 */
router.post('/generate', authenticate, validateLayoutRequest, async (req, res, next) => {
  try {
    const result = await generateLayout(req.body, req.user);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/layouts/:layoutId
 * Get a specific layout by ID
 */
router.get('/:layoutId', authenticate, async (req, res, next) => {
  try {
    const { layoutId } = req.params;
    const userId = req.user?.id;
    const { getDatabase } = await import('../db/database.js');
    const db = getDatabase();

    // Get layout from database
    let layout;
    try {
      layout = db.prepare(`
        SELECT 
          id, 
          user_id, 
          project_id, 
          layout_data, 
          created_at 
        FROM layouts 
        WHERE id = ?
      `).get(layoutId);
    } catch (dbError) {
      console.error('[Layouts] Database error:', dbError);
      return res.status(500).json({ error: 'Database error', message: 'Failed to query layout' });
    }

    if (!layout) {
      return res.status(404).json({ error: 'Layout not found' });
    }

    // Check if user has access (must be the owner)
    if (layout.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Parse layout_data with error handling
    let layoutData = null;
    try {
      layoutData = layout.layout_data ? JSON.parse(layout.layout_data) : null;
    } catch (parseError) {
      console.error('[Layouts] Failed to parse layout_data:', parseError);
      return res.status(500).json({ 
        error: 'Invalid layout data format',
        message: 'Layout data is corrupted and cannot be parsed'
      });
    }

    res.json({
      id: layout.id,
      project_id: layout.project_id,
      layout_data: layoutData,
      created_at: layout.created_at,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

