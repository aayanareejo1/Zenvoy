/**
 * Retry an async function with exponential backoff.
 *
 * @param {() => Promise<any>} fn
 * @param {object} opts
 * @param {number} opts.maxAttempts   – total attempts, default 3
 * @param {number} opts.baseDelayMs   – delay after first failure ms, default 1000
 * @param {(err: Error, attempt: number) => boolean} opts.shouldRetry
 *   – return false to abort immediately (e.g. auth errors); default always retries
 */
export const retryWithBackoff = async (fn, opts = {}) => {
  const { maxAttempts = 3, baseDelayMs = 1000, shouldRetry } = opts;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts) break;
      if (shouldRetry && !shouldRetry(err, attempt)) break;
      await sleep(baseDelayMs * Math.pow(2, attempt - 1)); // 1s → 2s → 4s
    }
  }
  throw lastErr;
};

/** True for errors that are worth retrying (network, 5xx, 429). */
export const isRetryable = (err) => {
  if (!err) return false;
  // Network-level failures
  if (err.message && (
    err.message.includes('Network request failed') ||
    err.message.includes('timeout') ||
    err.message.includes('ECONNRESET')
  )) return true;
  // HTTP status codes attached by our API wrapper
  if (err.status === 429) return true;   // rate limited
  if (err.status >= 500) return true;    // server error
  return false;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
