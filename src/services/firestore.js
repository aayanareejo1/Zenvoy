import { getFirestore, collection, doc, addDoc, getDocs, getDoc, setDoc } from '@react-native-firebase/firestore';
import { insertReceipt, getAllReceipts } from './db';
import { deriveStatus, normalizeNotes } from '../utils/receiptHelpers';

const db = getFirestore();

export const syncReceiptToFirestore = async (uid, receipt) => {
  try {
    await addDoc(collection(db, 'users', uid, 'receipts'), {
      vendor:    receipt.vendor    || null,
      date:      receipt.date      || null,
      total:     receipt.total,
      tax:       receipt.tax,
      category:  receipt.category  || 'Other',
      status:    receipt.status    || 'ready',
      notes:     normalizeNotes(receipt.notes),
      photoUri:  receipt.photo_uri || null,
      createdAt: receipt.created_at || null,
      updatedAt: receipt.updated_at || receipt.created_at || null,
    });
  } catch (e) {
    console.log('Firestore sync error:', e.message);
  }
};

export const fetchFirestoreReceipts = async (uid) => {
  try {
    const snapshot = await getDocs(collection(db, 'users', uid, 'receipts'));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.log('Firestore fetch error:', e.message);
    return [];
  }
};

/**
 * Restore receipts from Firestore into local SQLite.
 * Deduplicates on vendor + date + total.
 * Returns { imported, skipped, failed }.
 * No photo restore — if photo_uri is missing, viewer shows "not available".
 */
export const restoreFromFirestore = async (uid) => {
  let imported = 0, skipped = 0, failed = 0;
  try {
    const [remote, local] = await Promise.all([
      fetchFirestoreReceipts(uid),
      getAllReceipts(),
    ]);

    // Build a set of fingerprints from local receipts for fast dedup
    const localFingerprints = new Set(
      local.map(r => `${(r.vendor || '').toLowerCase()}|${r.date || ''}|${parseFloat(r.total).toFixed(2)}`)
    );

    for (const r of remote) {
      try {
        const fp = `${(r.vendor || '').toLowerCase()}|${r.date || ''}|${parseFloat(r.total || 0).toFixed(2)}`;
        if (localFingerprints.has(fp)) { skipped++; continue; }

        const receipt = {
          vendor:     r.vendor    || null,
          date:       r.date      || null,
          total:      parseFloat(r.total)  || 0,
          tax:        parseFloat(r.tax)    || 0,
          category:   r.category   || 'Other',
          status:     r.status     || deriveStatus(r),
          notes:      normalizeNotes(r.notes),
          photo_uri:  null, // cloud photo restore not supported yet
          created_at: r.createdAt  || new Date().toISOString(),
          updated_at: r.updatedAt  || r.createdAt || new Date().toISOString(),
        };
        await insertReceipt(receipt);
        localFingerprints.add(fp); // prevent dupe if remote has dupes
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
