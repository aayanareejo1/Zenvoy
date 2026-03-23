import {
  syncLocalChangesToFirestore,
  syncCloudChangesToLocal,
  retryFailedSyncs,
  listenToCloudReceipts,
} from './syncService';

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class SyncManager {
  constructor(user, onStatusChange) {
    this.user             = user;
    this.onStatusChange   = onStatusChange || (() => {});
    this.isSyncing        = false;
    this.lastSyncTime     = null;
    this._intervalId      = null;
    this._unsubscribeListener = null;
  }

  async performSync() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.onStatusChange('syncing');

    try {
      await syncLocalChangesToFirestore(this.user);
      await syncCloudChangesToLocal(this.user);
      await retryFailedSyncs(this.user);
      this.lastSyncTime = new Date();
      this.onStatusChange('synced');
    } catch (e) {
      console.log('SyncManager error:', e.message);
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
      this.user,
      async () => {
        // A cloud change was detected — run a full sync to apply it locally
        await this.performSync();
      }
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
