import firestore from '@react-native-firebase/firestore';

export const syncReceiptToFirestore = async (uid, receipt) => {
  try {
    await firestore().collection('users').doc(uid).collection('receipts').add({
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
    const snapshot = await firestore().collection('users').doc(uid).collection('receipts').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    console.log('Firestore fetch error:', e.message);
    return [];
  }
};

export const getSubscriptionStatus = async (uid) => {
  try {
    const doc = await firestore().collection('users').doc(uid).collection('subscription').doc('status').get();
    if (doc.exists) return doc.data();
    return { isPro: false };
  } catch (e) {
    return { isPro: false };
  }
};

export const setProStatus = async (uid, isPro, expiresAt) => {
  await firestore().collection('users').doc(uid).collection('subscription').doc('status').set({ isPro, expiresAt });
};
