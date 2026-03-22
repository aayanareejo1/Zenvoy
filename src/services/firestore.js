import { getFirestore, collection, doc, addDoc, getDocs, getDoc, setDoc } from '@react-native-firebase/firestore';

const db = getFirestore();

export const syncReceiptToFirestore = async (uid, receipt) => {
  try {
    await addDoc(collection(db, 'users', uid, 'receipts'), {
      vendor: receipt.vendor || null,
      date: receipt.date || null,
      total: receipt.total,
      tax: receipt.tax,
      category: receipt.category || 'Other',
      status: receipt.status || 'ready',
      notes: Array.isArray(receipt.notes) ? receipt.notes : [],
      photoUri: receipt.photo_uri || null,
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

export const getSubscriptionStatus = async (uid) => {
  try {
    const ref = doc(db, 'users', uid, 'subscription', 'status');
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data();
    return { isPro: false };
  } catch (e) {
    return { isPro: false };
  }
};

export const setProStatus = async (uid, isPro, expiresAt) => {
  await setDoc(doc(db, 'users', uid, 'subscription', 'status'), { isPro, expiresAt });
};
