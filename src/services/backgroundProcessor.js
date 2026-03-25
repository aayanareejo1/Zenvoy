// expo-background-fetch and expo-task-manager are temporarily removed due to
// a Kotlin 2.2 compilation conflict. Re-add them once Expo resolves support.
// import * as BackgroundFetch from 'expo-background-fetch';
// import * as TaskManager from 'expo-task-manager';
import { preprocessImage, isTooLarge } from './imageProcessor';
import { parseReceiptWithVision } from './claude';
import { updateReceiptFromScan } from './db';
import { deriveStatus } from '../utils/receiptHelpers';
import { updateStatus, incrementRetry, getRetryableItems } from './queueService';

const TASK_NAME = 'PROCESS_RECEIPT_QUEUE';
const MAX_RETRIES = 3;

/**
 * Calculate exponential back-off delay in ms for a given retry attempt.
 * Attempt 0 → 0ms, 1 → 2 s, 2 → 4 s, 3 → 8 s.
 */
const backoffDelay = (retryCount) =>
  retryCount > 0 ? Math.pow(2, retryCount) * 1000 : 0;

/**
 * Process a single queue item:
 * 1. Mark as 'processing'
 * 2. Pre-process image + call Claude Vision
 * 3. Save extracted fields to the linked receipt row
 * 4. Mark queue entry as 'completed'
 */
export const processQueueItem = async (queueItem) => {
  await updateStatus(queueItem.id, 'processing');

  try {
    const { uri: processedUri, size } = await preprocessImage(queueItem.photo_uri);

    if (isTooLarge(size)) {
      await updateReceiptFromScan(queueItem.receipt_id, {
        vendor: null, date: null, total: 0, tax: 0,
        category: 'Other', status: 'needs_review',
        notes: ['Image too large — please enter manually'],
      });
      await updateStatus(queueItem.id, 'completed', 'Image too large');
      return { success: true, skipped: true };
    }

    const parsed = await parseReceiptWithVision(processedUri);
    const status = deriveStatus(parsed);

    await updateReceiptFromScan(queueItem.receipt_id, {
      vendor:   parsed.vendor,
      date:     parsed.date,
      total:    parsed.total,
      tax:      parsed.tax,
      category: parsed.category,
      status,
      notes:    parsed.notes,
    });

    await updateStatus(queueItem.id, 'completed', null, parsed);
    return { success: true };
  } catch (error) {
    await handleQueueError(queueItem.id, error, queueItem.retry_count);
    return { success: false, error: error.message };
  }
};

/**
 * Handle a processing error with exponential back-off.
 * - retry_count < MAX_RETRIES → increment counter, reset to 'pending'
 * - retry_count >= MAX_RETRIES → mark as 'failed'
 */
export const handleQueueError = async (queueId, error, retryCount) => {
  const newCount = await incrementRetry(queueId);

  if (newCount < MAX_RETRIES) {
    const delay = backoffDelay(newCount);
    // Re-queue after delay (the background task will pick it up on next run)
    await new Promise(resolve => setTimeout(resolve, delay));
    await updateStatus(queueId, 'pending', error.message);
  } else {
    await updateStatus(queueId, 'failed', error.message);
  }
};

// ---------------------------------------------------------------------------
// Registration helpers — stubbed until expo-task-manager is restored
// ---------------------------------------------------------------------------

/** @todo Restore when expo-task-manager supports Kotlin 2.2. */
export const registerBackgroundTask   = async () => {};
export const unregisterBackgroundTask = async () => {};
