/**
 * Signed-in console account (admin or store owner): profile name and photo.
 */

import User from '../models/User.js';
import { uploadAvatar } from '../services/uploadService.js';

const toProfile = (doc) => ({
  id: doc._id.toString(),
  email: doc.email,
  name: doc.name || '',
  role: doc.role || 'user',
  avatar: doc.avatar || '',
  profilePicture: doc.profilePicture || null,
});

const accountController = {
  async getMe(req, res, next) {
    try {
      const dbUser = await User.findById(req.user.id).select('+profilePicture');
      if (!dbUser) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      res.json({ success: true, user: toProfile(dbUser) });
    } catch (error) {
      next(error);
    }
  },

  async updateProfile(req, res, next) {
    try {
      const dbUser = await User.findById(req.user.id).select('+profilePicture');
      if (!dbUser) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      if (req.body.name !== undefined) {
        dbUser.name = String(req.body.name).trim().slice(0, 100);
      }
      if (req.body.avatar !== undefined) {
        dbUser.avatar = String(req.body.avatar || '').trim();
      }
      if (req.body.profilePicture !== undefined) {
        dbUser.profilePicture = req.body.profilePicture || null;
      }

      await dbUser.save();
      res.json({ success: true, user: toProfile(dbUser) });
    } catch (error) {
      next(error);
    }
  },

  async uploadAvatar(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }
      const result = await uploadAvatar(req.file);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  },
};

export default accountController;
