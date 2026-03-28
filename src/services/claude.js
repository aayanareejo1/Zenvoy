import * as FileSystem from 'expo-file-system/legacy';
import { CLAUDE_API_KEY, CLAUDE_API_URL } from '../constants/config';
import { VALID_CATEGORY_KEYS, normalizeNotes, normalizeCategory } from '../utils/receiptHelpers';
import { retryWithBackoff, isPermanentError } from '../utils/retryUtils';

/** Translate a raw HTTP/API error into a user-friendly message. */
const friendlyMessage = (error) => {
  const status = error?.status ?? error?.statusCode;
  if (status === 401) return 'Invalid API key — please check your configuration.';
  if (status === 429) return 'Too many requests — please wait a moment and try again.';
  if (status >= 500)  return 'Claude service is temporarily unavailable. Retrying…';
  if (error?.message?.includes('Network request failed')) return 'No internet connection.';
  return 'Failed to read receipt — please enter details manually';
};

/**
 * Perform a single Claude API call and return the parsed JSON body.
 * Throws an enriched error (with `.status`) on non-2xx responses.
 */
const callClaudeApi = async (base64) => {
  const apiResponse = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text', text: `This is a Canadian receipt. If the receipt is in another language, translate vendor name to English. Currency amounts should be extracted as-is (numbers only, no currency symbol). Extract the following fields and return ONLY raw JSON, no markdown, no backticks, no explanation.

{
  "vendor": "store name or null if unreadable",
  "date": "YYYY-MM-DD or null if not found",
  "total": "22.70 or null if not found",
  "tax": "6.24 or 0.00 if no tax",
  "category": "one of: ${VALID_CATEGORY_KEYS.join(', ')}",
  "notes": ["short note about any uncertainty, missing field, or assumption"]
}

Rules:
- tax = sum of HST + GST + PST + QST; use "0.00" if none found
- category must be exactly one of the listed values; use "Other" if uncertain
- notes is an array of short strings; use [] if everything is clear
- Use null (not the string "null") for genuinely missing vendor/date/total` },
        ],
      }],
    }),
  });

  if (!apiResponse.ok) {
    const err = new Error(`Claude API error: ${apiResponse.status}`);
    err.status = apiResponse.status;
    // Attach the response body for error-type inspection where available
    try {
      const body = await apiResponse.json();
      err.type = body?.error?.type;
      err.error = body?.error;
    } catch (_) { /* ignore parse failures */ }
    throw err;
  }

  return apiResponse.json();
};

/**
 * Parse a receipt image with Claude vision.
 * Expects a pre-processed URI (already resized/compressed).
 * Returns parsed fields + an optional `_tokenWarning` flag.
 *
 * Network/5xx errors are retried up to 4 times with exponential backoff.
 * Permanent errors (401, image_too_large, etc.) are surfaced immediately.
 */
export const parseReceiptWithVision = async (imageUri) => {
  try {
    const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: 'base64' });

    const data = await retryWithBackoff(() => callClaudeApi(base64), { maxAttempts: 4, initialDelayMs: 1000 });

    const text = data.content[0].text.trim();
    const cleaned = text.replace(/```json|```/g, '').trim();
    const raw = JSON.parse(cleaned);

    const notes = normalizeNotes(raw.notes);
    const { category, notes: finalNotes } = normalizeCategory(raw.category, notes);

    // Flag unusually large token usage so the caller can educate the user.
    const totalTokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
    const tokenWarning = totalTokens >= 3000;

    return {
      vendor:  raw.vendor || null,
      date:    raw.date   || null,
      total:   raw.total  || null,
      tax:     raw.tax    || '0.00',
      category,
      notes: finalNotes,
      _tokenWarning: tokenWarning,
    };
  } catch (e) {
    console.log('Parse error:', e.message);
    const message = friendlyMessage(e);
    return {
      vendor:   null,
      date:     null,
      total:    null,
      tax:      '0.00',
      category: 'Other',
      notes:    [message],
      _tokenWarning: false,
      _error: message,
      _isPermanent: isPermanentError(e),
    };
  }
};
