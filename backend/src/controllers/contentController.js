/**
 * App content (FAQs, Terms of Service, Privacy Policy): public reads for the mobile app,
 * admin-only saves. Until an admin saves a piece of content, its defaults are served.
 */

import mongoose from 'mongoose';
import SiteContent from '../models/SiteContent.js';
import { logActivity } from '../services/activityLog.js';
import { DEFAULT_FAQS, DEFAULT_LEGAL } from '../services/defaultContent.js';

const MAX_FAQS = 100;
const MAX_LEGAL_LENGTH = 50000;
const LEGAL_TITLES = { terms: 'Terms of Service', privacy: 'Privacy Policy' };

const dbReady = () => mongoose.connection.readyState === 1;

const toFaqPayload = (doc) => ({
  faqs: doc ? doc.faqs.map(({ question, answer }) => ({ question, answer })) : DEFAULT_FAQS,
  isDefault: !doc,
  updatedAt: doc?.updatedAt ?? null,
});

const toLegalPayload = (key, doc) => ({
  title: LEGAL_TITLES[key],
  body: doc ? doc.body : DEFAULT_LEGAL[key],
  isDefault: !doc,
  updatedAt: doc?.updatedAt ?? null,
});

const contentController = {
  async getFaqs(req, res, next) {
    try {
      const doc = dbReady() ? await SiteContent.findOne({ key: 'faqs' }).lean() : null;
      res.json({ success: true, ...toFaqPayload(doc) });
    } catch (error) {
      next(error);
    }
  },

  async getLegal(req, res, next) {
    try {
      const docs = dbReady() ? await SiteContent.find({ key: { $in: ['terms', 'privacy'] } }).lean() : [];
      const byKey = Object.fromEntries(docs.map((doc) => [doc.key, doc]));
      res.json({
        success: true,
        terms: toLegalPayload('terms', byKey.terms),
        privacy: toLegalPayload('privacy', byKey.privacy),
      });
    } catch (error) {
      next(error);
    }
  },

  /** PUT /api/v1/admin/content/faqs — replaces the whole list, in the given order. */
  async updateFaqs(req, res, next) {
    try {
      const input = req.body?.faqs;
      if (!Array.isArray(input)) {
        return res.status(400).json({ success: false, error: 'faqs must be a list' });
      }
      if (input.length > MAX_FAQS) {
        return res.status(400).json({ success: false, error: `Keep it to ${MAX_FAQS} FAQs or fewer` });
      }

      const faqs = input.map((faq) => ({
        question: String(faq?.question ?? '').trim(),
        answer: String(faq?.answer ?? '').trim(),
      }));
      const incomplete = faqs.findIndex((faq) => !faq.question || !faq.answer);
      if (incomplete >= 0) {
        return res.status(400).json({ success: false, error: `FAQ ${incomplete + 1} needs both a question and an answer` });
      }

      const doc = await SiteContent.findOneAndUpdate(
        { key: 'faqs' },
        { faqs, updatedBy: req.user.email },
        { upsert: true, new: true, runValidators: true }
      ).lean();

      await logActivity(req.user, 'content.faqs_updated', {
        targetType: 'content',
        targetId: 'faqs',
        summary: `${req.user.email} updated the FAQs (${faqs.length} question${faqs.length === 1 ? '' : 's'})`,
      });
      res.json({ success: true, ...toFaqPayload(doc) });
    } catch (error) {
      if (error.name === 'ValidationError') {
        return res.status(400).json({ success: false, error: 'A question or answer is too long' });
      }
      next(error);
    }
  },

  /** PUT /api/v1/admin/content/legal/:key — key is "terms" or "privacy". */
  async updateLegal(req, res, next) {
    try {
      const { key } = req.params;
      if (!LEGAL_TITLES[key]) {
        return res.status(404).json({ success: false, error: 'Unknown legal page' });
      }

      const body = String(req.body?.body ?? '').trim();
      if (!body) {
        return res.status(400).json({ success: false, error: `${LEGAL_TITLES[key]} can't be empty` });
      }
      if (body.length > MAX_LEGAL_LENGTH) {
        return res.status(400).json({ success: false, error: `${LEGAL_TITLES[key]} is too long` });
      }

      const doc = await SiteContent.findOneAndUpdate(
        { key },
        { body, updatedBy: req.user.email },
        { upsert: true, new: true, runValidators: true }
      ).lean();

      await logActivity(req.user, `content.${key}_updated`, {
        targetType: 'content',
        targetId: key,
        summary: `${req.user.email} updated the ${LEGAL_TITLES[key]}`,
      });
      res.json({ success: true, [key]: toLegalPayload(key, doc) });
    } catch (error) {
      next(error);
    }
  },
};

export default contentController;
