import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore, collection, onSnapshot } from '@react-native-firebase/firestore';
import {
  getUnsyncedReceipts,
  getReceiptById,
  getAllReceipts,
  markReceiptSynced,
  insertReceiptFromCloud,
  updateReceiptFromCloud,
  insertFailedSync,
  getFailedSyncs,
  deleteFailedSync,
  updateFailedSyncAttempt,
} from './db';
import {
  updateReceiptInFirestore,
  softDeleteReceiptInFirestore,
  fetchFirestoreReceipts,
  getCloudReceipt,
} from './firestore';
import { normalizeNotes } from '../utils/receiptHelpers';
import { uploadReceiptPhoto, downloadReceiptPhoto } from './photoStorage';

const DEVICE_ID_KEY = '@zenvoy_device_id';

// --- Device ID ---

export async function getDeviceId() {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// --- Conflict resolution ---

/**
 * Decide which version wins: compare updated_at timestamps.
 * Returns 'local' or 'cloud'.
 */
export function resolveConflict(localReceipt, cloudReceipt) {
  const localTime = new Date(localReceipt.updated_at || localReceipt.created_at || 0).getTime();
  const cloudTime = new Date(cloudReceipt.updatedAt  || cloudReceipt.createdAt  || 0).getTime();
  return cloudTime > localTime ? 'cloud' : 'local';
}

// --- Push sync (Local → Cloud) ---

export async function syncLocalChangesToFirestore(user) {
  const deviceId = await getDeviceId();
  const unsynced = await getUnsyncedReceipts();

  for (const receipt of unsynced) {
    try {
      const firestoreId = receipt.firestore_id || String(receipt.id);

      // Check if a cloud version already exists
      const cloudReceipt = await getCloudReceipt(user.uid, firestoreId);

      if (cloudReceipt && (cloudReceipt.version || 1) > (receipt.version || 1)) {
        // Cloud is newer — resolve conflict
        const winner = resolveConflict(receipt, cloudReceipt);
        if (winner === 'cloud') {
          // Cloud wins: update local with cloud data and mark as synced
          await updateReceiptFromCloud(receipt.id, {
            vendor:   cloudReceipt.vendor,
            date:     cloudReceipt.date,
            total:    cloudReceipt.total,
            tax:      cloudReceipt.tax,
            category: cloudReceipt.category,
            status:   cloudReceipt.status,
            notes:    normalizeNotes(cloudReceipt.notes),
          }, firestoreId, cloudReceipt.version || 1);
          continue;
        }
        // Local wins: fall through to push with incremented version
      }

      // Reuse the existing storage URL if already uploaded; otherwise upload now.
      let photoStorageUrl = cloudReceipt?.photoStorageUrl || null;
      if (!photoStorageUrl && receipt.photo_uri) {
        try {
          photoStorageUrl = await uploadReceiptPhoto(user.uid, firestoreId, receipt.photo_uri);
        } catch (_) { /* non-fatal — receipt syncs without photo */ }
      }

      const newVersion = (receipt.version || 1) + 1;
      await updateReceiptInFirestore(user.uid, {
        ...receipt,
        firestore_id:      firestoreId,
        version:           newVersion,
        device_id:         deviceId,
        photo_storage_url: photoStorageUrl,
      });
      await markReceiptSynced(receipt.id, firestoreId, newVersion);
    } catch {
      await insertFailedSync(receipt.id, 'push', '[push sync error]');
    }
  }
}

// --- Pull sync (Cloud → Local) ---

export async function syncCloudChangesToLocal(user) {
  try {
    const cloudReceipts = await fetchFirestoreReceipts(user.uid);
    const localAll      = await getAllReceipts();

    // Index local receipts by their Firestore ID for O(1) lookup
    const localByFirestoreId = new Map(
      localAll.filter(r => r.firestore_id).map(r => [r.firestore_id, r])
    );

    for (const cloud of cloudReceipts) {
      try {
        const existing = localByFirestoreId.get(cloud.id);

        if (cloud.isDeleted) {
          // Soft-delete on cloud → mark local as deleted if it exists
          if (existing && existing.status !== 'deleted') {
            await updateReceiptFromCloud(existing.id, {
              ...existing,
              status: 'deleted',
            }, cloud.id, cloud.version || 1);
          }
          continue;
        }

        if (!existing) {
          // Not in local DB: insert it (download photo if available in storage)
          const photo_uri = cloud.photoStorageUrl
            ? await downloadReceiptPhoto(cloud.photoStorageUrl, cloud.id).catch(() => null)
            : null;
          await insertReceiptFromCloud({
            vendor:       cloud.vendor,
            date:         cloud.date,
            total:        cloud.total || 0,
            tax:          cloud.tax   || 0,
            category:     cloud.category  || 'Other',
            status:       cloud.status    || 'ready',
            notes:        normalizeNotes(cloud.notes),
            photo_uri,
            created_at:   cloud.createdAt || new Date().toISOString(),
            updated_at:   cloud.updatedAt || cloud.createdAt || new Date().toISOString(),
            version:      cloud.version   || 1,
            device_id:    cloud.deviceId  || null,
            firestore_id: cloud.id,
          });
        } else if ((cloud.version || 1) > (existing.version || 1)) {
          // Cloud is newer: update local
          await updateReceiptFromCloud(existing.id, {
            vendor:   cloud.vendor,
            date:     cloud.date,
            total:    cloud.total || 0,
            tax:      cloud.tax   || 0,
            category: cloud.category || 'Other',
            status:   cloud.status   || 'ready',
            notes:    normalizeNotes(cloud.notes),
          }, cloud.id, cloud.version || 1);
        }
        // local.version >= cloud.version → skip (local is same or newer)
      } catch { console.log('[SyncService] pull sync receipt error occurred'); }
    }
  } catch {
    console.log('[SyncService] pull sync error occurred');
  }
}

// --- Failed sync queue ---

export async function queueFailedSync(receiptId, operation, error) {
  await insertFailedSync(receiptId, operation, '[sync error]');
}

export async function retryFailedSyncs(user) {
  const deviceId = await getDeviceId();
  const failed   = await getFailedSyncs();

  for (const item of failed) {
    try {
      if (item.operation === 'delete') {
        // Re-try soft-deleting from Firestore; receipt_id is used as the Firestore doc ID
        await softDeleteReceiptInFirestore(user.uid, String(item.receipt_id));
      } else {
        // Re-try pushing the receipt if it still exists locally
        const receipt = await getReceiptById(item.receipt_id);
        if (receipt) {
          const firestoreId = receipt.firestore_id || String(receipt.id);
          const newVersion  = (receipt.version || 1) + 1;
          await updateReceiptInFirestore(user.uid, {
            ...receipt,
            firestore_id: firestoreId,
            version:      newVersion,
            device_id:    deviceId,
          });
          await markReceiptSynced(receipt.id, firestoreId, newVersion);
        }
      }
      await deleteFailedSync(item.id);
    } catch (e) {
      const newCount = (item.attempt_count || 1) + 1;
      await updateFailedSyncAttempt(item.id, newCount);
    }
  }
}

// --- Real-time listener ---

/**
 * Listen for cloud receipt changes using Firestore's onSnapshot.
 * Calls onUpdate(type, data) for each document change.
 * Returns an unsubscribe function.
 */
export function listenToCloudReceipts(user, onUpdate) {
  const fsdb  = getFirestore();
  const ref   = collection(fsdb, 'users', user.uid, 'receipts');

  const unsubscribe = onSnapshot(
    ref,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = { id: change.doc.id, ...change.doc.data() };
        onUpdate(change.type, data).catch(() =>
          console.log('[SyncService] listenToCloudReceipts onUpdate error occurred')
        );
      });
    },
    () => console.log('[SyncService] Firestore listener error occurred')
  );

  return unsubscribe;
}
