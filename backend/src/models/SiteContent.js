/**
 * Admin-editable app content: the FAQ list and the legal pages, one document per key.
 * A missing document means the admin hasn't saved that content yet (defaults are served).
 */

import mongoose from 'mongoose';

export const CONTENT_KEYS = ['faqs', 'terms', 'privacy'];

const faqSchema = new mongoose.Schema({
  question: { type: String, required: true, trim: true, maxlength: 300 },
  answer: { type: String, required: true, trim: true, maxlength: 3000 },
}, { _id: false });

const siteContentSchema = new mongoose.Schema({
  key: { type: String, enum: CONTENT_KEYS, required: true, unique: true },
  /** Used when key is "faqs". */
  faqs: { type: [faqSchema], default: undefined },
  /** Used for legal pages. Plain text: "## " starts a heading, "• " or "- " a bullet. */
  body: { type: String, default: undefined },
  updatedBy: { type: String, default: '' },
}, {
  timestamps: true,
  collection: 'site_content',
});

const SiteContent = mongoose.models.SiteContent || mongoose.model('SiteContent', siteContentSchema);

export default SiteContent;
