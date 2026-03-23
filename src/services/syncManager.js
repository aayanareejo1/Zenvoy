import { syncReceiptToFirestore } from './firestore';
import {
  getDb,
  getFailedSyncs,
  deleteFailedSync,
  incrementFailedSyncAttempt,
} from './db';

const MAX_ATTEMPTS = 5;
export { MAX_ATTEMPTS };

/**
 * Retry all entries in the failed_syncs queue for the given user.
 * Returns { succeeded, failed }.
 */
export const retryFailedSyncs = async (uid) => {
  const items = await getFailedSyncs();
  let succeeded = 0;
  let failed    = 0;

  for (const item of items) {
    if (item.attempt_count >= MAX_ATTEMPTS) { failed++; continue; }

    try {
      // Re-fetch the receipt row to get current data
      const database = await getDb();
      const receipt  = await database.getFirstAsync(
        'SELECT * FROM receipts WHERE id = ?',
        [item.receipt_id]
      );
      if (!receipt) { await deleteFailedSync(item.id); continue; }

      await syncReceiptToFirestore(uid, receipt);
      // Mark local receipt as synced
      await database.runAsync(
        'UPDATE receipts SET synced = 1 WHERE id = ?',
        [receipt.id]
      );
      await deleteFailedSync(item.id);
      succeeded++;
    } catch (e) {
      console.error('Sync retry failed for item', item.id, ':', e.message);
      await incrementFailedSyncAttempt(item.id);
      failed++;
    }
  }

  return { succeeded, failed };
};

/**
 * Retry a single failed_sync entry.
 */
export const retryOne = async (failedSyncId, uid) => {
  const database = await getDb();
  const item     = await database.getFirstAsync(
    'SELECT * FROM failed_syncs WHERE id = ?',
    [failedSyncId]
  );
  if (!item) return;

  try {
    const receipt = await database.getFirstAsync(
      'SELECT * FROM receipts WHERE id = ?',
      [item.receipt_id]
    );
    if (!receipt) { await deleteFailedSync(item.id); return; }

    await syncReceiptToFirestore(uid, receipt);
    await database.runAsync(
      'UPDATE receipts SET synced = 1 WHERE id = ?',
      [receipt.id]
    );
    await deleteFailedSync(item.id);
  } catch (e) {
    console.error('Single sync retry failed for failedSyncId', failedSyncId, ':', e.message);
    await incrementFailedSyncAttempt(item.id);
    throw e;
  }
};
