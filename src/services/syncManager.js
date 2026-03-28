import { getFirestore, collection, onSnapshot } from '@react-native-firebase/firestore';
import { syncReceiptToFirestore, restoreFromFirestore } from './firestore';
import {
  getDb,
  getUnsyncedReceipts,
  markReceiptSynced,
  getFailedSyncs,
  deleteFailedSync,
  incrementFailedSyncAttempt,
  insertFailedSync,
} from './db';

export const MAX_ATTEMPTS = 5;

// ─── Push local unsynced receipts → Firestore ─────────────────────────────────

const syncLocalToCloud = async (uid) => {
  const unsynced = await getUnsyncedReceipts();
  for (const receipt of unsynced) {
    // Skip soft-deleted receipts that already have a firestore_id — handled by softDelete call
    try {
      await syncReceiptToFirestore(uid, receipt);
      await markReceiptSynced(receipt.id, receipt.firestore_id || String(receipt.id));
    } catch (e) {
      await insertFailedSync(receipt.id, e.message, 'push');
    }
  }
};

// ─── Retry items in failed_syncs queue ────────────────────────────────────────

export const retryFailedSyncs = async (uid) => {
  const items = await getFailedSyncs();
  let succeeded = 0;
  let failed = 0;

  for (const item of items) {
    if (item.attempt_count >= MAX_ATTEMPTS) { failed++; continue; }

    try {
      const database = await getDb();
      const receipt = await database.getFirstAsync(
        'SELECT * FROM receipts WHERE id = ?',
        [item.receipt_id]
      );
      if (!receipt) { await deleteFailedSync(item.id); continue; }

      await syncReceiptToFirestore(uid, receipt);
      await database.runAsync('UPDATE receipts SET synced = 1 WHERE id = ?', [receipt.id]);
      await deleteFailedSync(item.id);
      succeeded++;
    } catch (e) {
      console.error('[SyncManager] retry failed for item:', item.id);
      await incrementFailedSyncAttempt(item.id);
      failed++;
    }
  }

  return { succeeded, failed };
};

// ─── Retry a single failed_sync entry ─────────────────────────────────────────

export const retryOne = async (failedSyncId, uid) => {
  const database = await getDb();
  const item = await database.getFirstAsync(
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
    await database.runAsync('UPDATE receipts SET synced = 1 WHERE id = ?', [receipt.id]);
    await deleteFailedSync(item.id);
  } catch (e) {
    console.error('[SyncManager] single retry failed for id:', failedSyncId);
    await incrementFailedSyncAttempt(item.id);
    throw e;
  }
};

// ─── Real-time cloud listener ──────────────────────────────────────────────────

const listenToCloudReceipts = (uid, onChange) => {
  const db = getFirestore();
  return onSnapshot(collection(db, 'users', uid, 'receipts'), onChange);
};

// ─── SyncManager class ────────────────────────────────────────────────────────

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class SyncManager {
  constructor(user, onStatusChange) {
    this.user                 = user;
    this.onStatusChange       = onStatusChange || (() => {});
    this.isSyncing            = false;
    this.lastSyncTime         = null;
    this._intervalId          = null;
    this._unsubscribeListener = null;
  }

  async performSync() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.onStatusChange('syncing');

    try {
      const uid = this.user.uid;
      await syncLocalToCloud(uid);
      await restoreFromFirestore(uid);
      await retryFailedSyncs(uid);
      this.lastSyncTime = new Date();
      this.onStatusChange('synced');
    } catch (e) {
      console.log('[SyncManager] sync error occurred');
      this.onStatusChange('error');
    } finally {
      this.isSyncing = false;
    }
  }

  startPeriodicSync() {
    this.stopPeriodicSync();
    this._intervalId = setInterval(() => this.performSync(), SYNC_INTERVAL_MS);
  }

  stopPeriodicSync() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  startListening() {
    this.stopListening();
    this._unsubscribeListener = listenToCloudReceipts(
      this.user.uid,
      () => this.performSync()
    );
  }

  stopListening() {
    if (this._unsubscribeListener) {
      this._unsubscribeListener();
      this._unsubscribeListener = null;
    }
  }

  destroy() {
    this.stopPeriodicSync();
    this.stopListening();
  }
}
