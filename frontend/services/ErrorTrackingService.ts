/**
 * Error Tracking Service
 * Integrates Sentry for error monitoring in React Native
 */

let Sentry: any = null;

// Try to load Sentry if DSN is configured
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

/**
 * Initialize Sentry error tracking
 */
export async function initErrorTracking() {
  if (!SENTRY_DSN) {
    console.log('[ErrorTracking] Sentry DSN not configured - skipping initialization');
    return;
  }

  try {
    // Dynamic import to avoid errors if Sentry is not installed
    // Use require with try-catch for optional dependency
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const SentryModule = require('@sentry/react-native');
    Sentry = SentryModule.default || SentryModule;

    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT || __DEV__ ? 'development' : 'production',
      enableInExpoDevelopment: false, // Disable in Expo Go
      debug: __DEV__,
      tracesSampleRate: __DEV__ ? 1.0 : 0.1,
      beforeSend(event: any, hint: any) {
        // Filter out sensitive data
        if (event.request) {
          // Remove sensitive headers
          if (event.request.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers.cookie;
          }
        }
        return event;
      },
    });

    console.log('[ErrorTracking] Sentry initialized successfully');
  } catch (error) {
    console.warn('[ErrorTracking] Failed to initialize Sentry:', error);
  }
}

/**
 * Capture exception
 */
export function captureException(error: Error, context?: Record<string, unknown>) {
  if (!Sentry) {
    console.error('[Error]', error, context);
    return;
  }

  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture message
 */
export function captureMessage(
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' | 'fatal' = 'info',
  context?: Record<string, unknown>
) {
  if (!Sentry) {
    console.log(`[${level.toUpperCase()}]`, message, context);
    return;
  }

  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Set user context
 */
export function setUser(user: { id?: string; email?: string; username?: string }) {
  if (!Sentry) return;

  Sentry.setUser(user);
}

/**
 * Add breadcrumb
 */
export function addBreadcrumb(breadcrumb: {
  message: string;
  category?: string;
  level?: 'debug' | 'info' | 'warning' | 'error';
  data?: Record<string, unknown>;
}) {
  if (!Sentry) return;

  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Set context
 */
export function setContext(name: string, context: Record<string, unknown>) {
  if (!Sentry) return;

  Sentry.setContext(name, context);
}
