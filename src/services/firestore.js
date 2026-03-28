import { getFirestore, collection, doc, setDoc, getDocs, getDoc } from '@react-native-firebase/firestore';
import { insertReceipt, getAllReceipts } from './db';
import { deriveStatus, normalizeNotes } from '../utils/receiptHelpers';
import { downloadReceiptPhoto } from './photoStorage';

const db = getFirestore();

/** Push a receipt to Firestore. Uses SQLite id as the doc key so updates/deletes work. */
export const syncReceiptToFirestore = async (uid, receipt) => {
  const firestoreId = receipt.firestore_id || String(receipt.id);
  const docRef = doc(db, 'users', uid, 'receipts', firestoreId);
  await setDoc(docRef, {
    vendor:           receipt.vendor           || null,
    date:             receipt.date             || null,
    total:            receipt.total,
    tax:              receipt.tax,
    category:         receipt.category         || 'Other',
    status:           receipt.status           || 'ready',
    notes:            normalizeNotes(receipt.notes),
    photoUri:         receipt.photo_uri        || null,
    photoStorageUrl:  receipt.photo_storage_url || null,
    createdAt:        receipt.created_at        || null,
    updatedAt:        receipt.updated_at        || receipt.created_at || null,
    version:          receipt.version           || 1,
    deviceId:         receipt.device_id         || null,
    isDeleted:        false,
  });
};

/** Update specific fields on an existing Firestore receipt doc. */
export const updateReceiptInFirestore = async (uid, receipt) => {
  const firestoreId = receipt.firestore_id || String(receipt.id);
  await setDoc(doc(db, 'users', uid, 'receipts', firestoreId), {
    vendor:           receipt.vendor           || null,
    date:             receipt.date             || null,
    total:            receipt.total,
    tax:              receipt.tax,
    category:         receipt.category         || 'Other',
    status:           receipt.status           || 'ready',
    notes:            normalizeNotes(receipt.notes),
    photoUri:         receipt.photo_uri        || null,
    photoStorageUrl:  receipt.photo_storage_url || null,
    createdAt:        receipt.created_at        || null,
    updatedAt:        new Date().toISOString(),
    version:          (receipt.version || 1) + 1,
    deviceId:         receipt.device_id         || null,
    isDeleted:        false,
  });
};

/** Soft-delete: marks isDeleted=true so other devices skip on restore. */
export const softDeleteReceiptInFirestore = async (uid, receiptId, firestoreId) => {
  const id = firestoreId || String(receiptId);
  await setDoc(doc(db, 'users', uid, 'receipts', id), {
    isDeleted: true,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
};

/** Fetch all non-deleted cloud receipts for a user. */
export const fetchFirestoreReceipts = async (uid) => {
  try {
    const snapshot = await getDocs(collection(db, 'users', uid, 'receipts'));
    return snapshot.docs
      .map(d => ({ firestoreId: d.id, ...d.data() }))
      .filter(r => !r.isDeleted);
  } catch (e) {
    console.log('Firestore fetch error:', e.message);
    return [];
  }
};

/** Fetch a single cloud receipt by Firestore doc ID. */
export const getCloudReceipt = async (uid, firestoreId) => {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'receipts', firestoreId));
    if (snap.exists()) return { firestoreId: snap.id, ...snap.data() };
    return null;
  } catch (e) {
    console.log('Firestore getCloudReceipt error:', e.message);
    return null;
  }
};

/**
 * Restore receipts from Firestore into local SQLite.
 * Deduplicates on vendor + date + total.
 * Returns { imported, skipped, failed }.
 */
export const restoreFromFirestore = async (uid) => {
  let imported = 0, skipped = 0, failed = 0;
  try {
    const [remote, local] = await Promise.all([
      fetchFirestoreReceipts(uid),
      getAllReceipts(),
    ]);

    const localFingerprints = new Set(
      local.map(r => `${(r.vendor || '').toLowerCase()}|${r.date || ''}|${parseFloat(r.total).toFixed(2)}`)
    );

    for (const r of remote) {
      try {
        const fp = `${(r.vendor || '').toLowerCase()}|${r.date || ''}|${parseFloat(r.total || 0).toFixed(2)}`;
        if (localFingerprints.has(fp)) { skipped++; continue; }

        const photoUri = r.photoStorageUrl
          ? await downloadReceiptPhoto(r.photoStorageUrl, r.firestoreId || String(r.id)).catch(() => null)
          : null;
        const receipt = {
          vendor:     r.vendor    || null,
          date:       r.date      || null,
          total:      parseFloat(r.total)  || 0,
          tax:        parseFloat(r.tax)    || 0,
          category:   r.category   || 'Other',
          status:     r.status     || deriveStatus(r),
          notes:      normalizeNotes(r.notes),
          photo_uri:  photoUri,
          created_at: r.createdAt  || new Date().toISOString(),
          updated_at: r.updatedAt  || r.createdAt || new Date().toISOString(),
        };
        await insertReceipt(receipt);
        localFingerprints.add(fp);
        imported++;
      } catch (_) {
        failed++;
      }
    }
  } catch (e) {
    console.log('Restore error:', e.message);
    failed++;
  }
  return { imported, skipped, failed };
};

export const getSubscriptionStatus = async (uid) => {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'subscription', 'status'));
    if (snap.exists()) return snap.data();
    return { isPro: false };
  } catch {
    return { isPro: false };
  }
};

export const setProStatus = async (uid, isPro, expiresAt) => {
  await setDoc(doc(db, 'users', uid, 'subscription', 'status'), { isPro, expiresAt });
};
