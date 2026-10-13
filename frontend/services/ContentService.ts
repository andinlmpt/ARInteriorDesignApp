/**
 * App content managed by admins in the web console: Help FAQs and the legal pages.
 */

import { callApi } from '@/services/apiClient';

export interface Faq {
  question: string;
  answer: string;
}

export interface LegalDoc {
  title: string;
  /** Plain text: "## " starts a heading, "• " or "- " a bullet (see utils/legalText). */
  body: string;
  isDefault: boolean;
  updatedAt: string | null;
}

export type LegalKey = 'terms' | 'privacy';

export const ContentService = {
  getFaqs() {
    return callApi<{ faqs: Faq[]; isDefault: boolean; updatedAt: string | null }>('/content/faqs', {
      timeoutMs: 8000,
    });
  },

  getLegal() {
    return callApi<Record<LegalKey, LegalDoc>>('/content/legal', { timeoutMs: 8000 });
  },
};
