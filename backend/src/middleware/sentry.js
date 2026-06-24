/**
 * Sentry Error Tracking Middleware
 * Integrates Sentry for error monitoring and performance tracking
 */

let Sentry = null;
let SentryLoaded = false;

/**
 * Load Sentry SDK if DSN is configured
 */
async function loadSentry() {
  if (SentryLoaded || !process.env.SENTRY_DSN) {
    return;
  }

  try {
    const SentryModule = await import('@sentry/node');
    Sentry = SentryModule.default || SentryModule;
    SentryLoaded = true;
  } catch (error) {
    console.warn('[Sentry] Failed to load Sentry SDK:', error.message);
    SentryLoaded = true; // Mark as loaded to prevent retries
  }
}

/**
 * Initialize Sentry if DSN is provided
 */
export async function initSentry() {
  await loadSentry();

  if (!Sentry || !process.env.SENTRY_DSN) {
    console.log('[Sentry] Not configured - skipping initialization');
    return;
  }

  try {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      integrations: [
        // Add integrations as needed
      ],
      beforeSend(event, hint) {
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

    console.log('[Sentry] Initialized successfully');
  } catch (error) {
    console.error('[Sentry] Failed to initialize:', error);
  }
}

/**
 * Sentry request handler middleware
 */
export function sentryRequestHandler() {
  if (!Sentry) {
    return (req, res, next) => next();
  }

  return Sentry.Handlers.requestHandler();
}

/**
 * Sentry tracing handler middleware
 */
export function sentryTracingHandler() {
  if (!Sentry) {
    return (req, res, next) => next();
  }

  return Sentry.Handlers.tracingHandler();
}

/**
 * Sentry error handler middleware (must be before error handler)
 */
export function sentryErrorHandler() {
  if (!Sentry) {
    return (err, req, res, next) => next(err);
  }

  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Don't report 4xx errors (client errors)
      if (error.status && error.status >= 400 && error.status < 500) {
        return false;
      }
      return true;
    },
  });
}

/**
 * Capture exception manually
 */
export function captureException(error, context = {}) {
  if (!Sentry) {
    console.error('[Error]', error, context);
    return;
  }

  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture message manually
 */
export function captureMessage(message, level = 'info', context = {}) {
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
export function setUser(user) {
  if (!Sentry) return;

  Sentry.setUser(user);
}

/**
 * Add breadcrumb
 */
export function addBreadcrumb(breadcrumb) {
  if (!Sentry) return;

  Sentry.addBreadcrumb(breadcrumb);
}
