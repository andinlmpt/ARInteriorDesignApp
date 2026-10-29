/**
 * Storage keys for the signed-in session and onboarding. Accounts live on the backend (MongoDB);
 * the demo accounts with plain-text passwords that used to be listed here are gone (2026-10-30).
 */

/**
 * Storage key for authenticated user session
 */
export const AUTH_USER_STORAGE_KEY = 'app.auth.user';

/**
 * Storage key for user preferences
 */
export const USER_PREFERENCES_STORAGE_KEY = 'app.user.preferences';

/**
 * Storage key for onboarding completion status
 */
export const ONBOARDING_COMPLETED_KEY = 'onboarding_completed';
