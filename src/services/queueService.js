import {
  insertQueueEntry,
  getQueueEntries,
  updateQueueEntry,
  incrementQueueRetryCount,
  getQueueEntryById,
} from './db'; // these are now all exported from db.js

/** Insert a new queue entry for a receipt that needs processing. */
export const createQueueEntry = async (receiptId, photoUri) => {
  return insertQueueEntry(receiptId, photoUri);
};

/** Fetch all queue items in 'pending' status. */
export const getPendingItems = async () => {
  return getQueueEntries('pending');
};

/** Fetch all queue items in 'processing' status. */
export const getProcessingItems = async () => {
  return getQueueEntries('processing');
};

/**
 * Update the status of a queue entry.
 * @param {number}  queueId
 * @param {string}  status         - 'pending'|'processing'|'completed'|'failed'
 * @param {string}  [errorMessage] - Optional error description
 * @param {object}  [result]       - Optional extracted receipt data (stored as JSON)
 */
export const updateStatus = async (queueId, status, errorMessage = null, result = null) => {
  const now = new Date().toISOString();
  const updates = { status };

  if (status === 'processing') updates.started_at    = now;
  if (status === 'completed')  updates.completed_at  = now;
  if (status === 'failed')     updates.completed_at  = now;

  if (errorMessage !== null) updates.error_message = errorMessage;
  if (result       !== null) updates.result         = JSON.stringify(result);

  await updateQueueEntry(queueId, updates);
};

/** Increment the retry counter for a queue entry. */
export const incrementRetry = async (queueId) => {
  return incrementQueueRetryCount(queueId);
};

/**
 * Return items that can be retried:
 * status='pending' OR (status='processing' and started_at older than 5 minutes).
 * This covers items that were interrupted mid-flight.
 */
export const getRetryableItems = async () => {
  const pending    = await getQueueEntries('pending');
  const processing = await getQueueEntries('processing');

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const staleProcessing = processing.filter(
    item => item.started_at && item.started_at < fiveMinutesAgo
  );

  return [...pending, ...staleProcessing];
};
