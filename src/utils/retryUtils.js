/**
 * Retry utilities — exponential backoff and error classification.
 */

const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_INITIAL_DELAY_MS = 1000;

/**
 * Return true for errors that are worth retrying automatically:
 *   - Network / connection errors (no status code)
 *   - HTTP 408 (Request Timeout)
 *   - HTTP 429 (Rate Limited)
 *   - HTTP 5xx (Server Errors)
 */
export const isRetryableError = (error) => {
  if (!error) return false;

  // Network-level failure — no HTTP status
  if (!error.status && (
    error.message?.includes('Network request failed') ||
    error.message?.includes('network') ||
    error.message?.includes('timeout') ||
    error.message?.includes('ECONNRESET') ||
    error.message?.includes('ENOTFOUND')
  )) {
    return true;
  }

  const status = error.status ?? error.statusCode;
  if (!status) return false;

  return status === 408 || status === 429 || (status >= 500 && status <= 599);
};

// Keep the old name as an alias so existing callers don't break
export const isRetryable = isRetryableError;

/**
 * Return true for errors that should never be retried:
 *   - HTTP 400 Bad Request
 *   - HTTP 401 Unauthorized (invalid API key)
 *   - HTTP 403 Forbidden
 *   - HTTP 404 Not Found
 *   - Payload-specific errors (image too large, etc.)
 */
export const isPermanentError = (error) => {
  if (!error) return false;

  const status = error.status ?? error.statusCode;
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return true;
  }

  // Claude-specific permanent error types
  const errorType = error.type ?? error.error?.type;
  if (
    errorType === 'image_too_large' ||
    errorType === 'invalid_request_error' ||
    errorType === 'authentication_error' ||
    errorType === 'permission_error' ||
    errorType === 'not_found_error'
  ) {
    return true;
  }

  return false;
};

/**
 * Calculate exponential back-off delay in milliseconds.
 * attempt 0 → initialDelayMs, 1 → 2×, 2 → 4×, 3 → 8×, …
 * Caps at 30 seconds.
 */
export const backoffDelay = (attempt, initialDelayMs = DEFAULT_INITIAL_DELAY_MS) => {
  const delay = initialDelayMs * Math.pow(2, attempt);
  return Math.min(delay, 30000);
};

/**
 * Execute `fn` with automatic retry using exponential backoff.
 *
 * @param {() => Promise<any>} fn            - Async function to execute.
 * @param {object}             [options]
 * @param {number}             [options.maxAttempts=4]       - Total attempts (including first try).
 * @param {number}             [options.initialDelayMs=1000] - Base delay for backoff.
 * @param {(err: Error) => boolean} [options.shouldRetry]    - Custom predicate; defaults to isRetryableError.
 * @returns {Promise<any>} Result of the first successful invocation.
 * @throws  Last error if all attempts are exhausted or error is permanent.
 */
export const retryWithBackoff = async (fn, options = {}) => {
  const {
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    initialDelayMs = DEFAULT_INITIAL_DELAY_MS,
    shouldRetry = isRetryableError,
  } = options;

  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // Never retry permanent errors
      if (isPermanentError(err)) throw err;

      // Stop if the caller says this error is not retryable
      if (!shouldRetry(err)) throw err;

      // Stop if we've used all attempts
      if (attempt >= maxAttempts - 1) throw err;

      // Wait before the next attempt
      const delay = backoffDelay(attempt, initialDelayMs);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Fallback (maxAttempts <= 0)
  throw lastError ?? new Error('retryWithBackoff: no attempts made');
};
