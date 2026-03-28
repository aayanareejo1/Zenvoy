/**
 * photoStorage.js — Firebase Storage helpers for receipt photos.
 *
 * Upload: called during push sync so each receipt's photo lands in cloud.
 * Download: called during pull sync / restore so the photo is available locally.
 */
import storage from '@react-native-firebase/storage';
import * as FileSystem from 'expo-file-system/legacy';

const PHOTO_DIR = `${FileSystem.documentDirectory}zenvoy_photos/`;

/**
 * Upload a local receipt photo to Firebase Storage.
 * @param {string} userId      Firebase UID
 * @param {string} receiptId   Firestore document ID (used as the storage filename)
 * @param {string} localUri    file:// URI or absolute path returned by the camera/image-picker
 * @returns {Promise<string>}  Public download URL
 */
export async function uploadReceiptPhoto(userId, receiptId, localUri) {
  const storagePath = `users/${userId}/receipts/${receiptId}.jpg`;
  const ref = storage().ref(storagePath);
  await ref.putFile(localUri);
  return ref.getDownloadURL();
}

/**
 * Download a receipt photo from Firebase Storage to local device storage.
 * No-ops if the file already exists (idempotent cache).
 * @param {string} downloadUrl  HTTPS download URL from Firebase Storage
 * @param {string} receiptId    Used as the local filename
 * @returns {Promise<string>}   Absolute local path to the downloaded file
 */
export async function downloadReceiptPhoto(downloadUrl, receiptId) {
  await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
  const dest = `${PHOTO_DIR}${receiptId}.jpg`;
  const info = await FileSystem.getInfoAsync(dest);
  if (!info.exists) {
    await FileSystem.downloadAsync(downloadUrl, dest);
  }
  return dest;
}
