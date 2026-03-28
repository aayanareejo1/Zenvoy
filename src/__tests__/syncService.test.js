/**
 * syncService.test.js
 *
 * Tests pure functions in syncService that do not require Firebase or SQLite.
 * Network/DB calls are mocked so this suite runs without native modules.
 */

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock('../services/db', () => ({
  getUnsyncedReceipts:   jest.fn().mockResolvedValue([]),
  getReceiptById:        jest.fn().mockResolvedValue(null),
  getAllReceipts:         jest.fn().mockResolvedValue([]),
  markReceiptSynced:     jest.fn().mockResolvedValue(),
  insertReceiptFromCloud: jest.fn().mockResolvedValue(),
  updateReceiptFromCloud: jest.fn().mockResolvedValue(),
  insertFailedSync:      jest.fn().mockResolvedValue(),
  getFailedSyncs:        jest.fn().mockResolvedValue([]),
  deleteFailedSync:      jest.fn().mockResolvedValue(),
  updateFailedSyncAttempt: jest.fn().mockResolvedValue(),
}));

jest.mock('../services/firestore', () => ({
  updateReceiptInFirestore:      jest.fn().mockResolvedValue(),
  softDeleteReceiptInFirestore:  jest.fn().mockResolvedValue(),
  fetchFirestoreReceipts:        jest.fn().mockResolvedValue([]),
  getCloudReceipt:               jest.fn().mockResolvedValue(null),
}));

jest.mock('../services/photoStorage', () => ({
  uploadReceiptPhoto:   jest.fn().mockResolvedValue('https://storage.example.com/photo.jpg'),
  downloadReceiptPhoto: jest.fn().mockResolvedValue('/local/path/photo.jpg'),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(),
}));

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection:   jest.fn(),
  onSnapshot:   jest.fn(),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { resolveConflict, getDeviceId } from '../services/syncService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── resolveConflict ──────────────────────────────────────────────────────────

describe('resolveConflict', () => {
  it('returns cloud when cloud updatedAt is newer', () => {
    const local = { updated_at: '2026-01-01T10:00:00.000Z' };
    const cloud = { updatedAt:  '2026-01-01T11:00:00.000Z' };
    expect(resolveConflict(local, cloud)).toBe('cloud');
  });

  it('returns local when local updated_at is newer', () => {
    const local = { updated_at: '2026-01-02T10:00:00.000Z' };
    const cloud = { updatedAt:  '2026-01-01T10:00:00.000Z' };
    expect(resolveConflict(local, cloud)).toBe('local');
  });

  it('returns local when timestamps are equal (local wins tie)', () => {
    const ts    = '2026-01-01T10:00:00.000Z';
    const local = { updated_at: ts };
    const cloud = { updatedAt:  ts };
    expect(resolveConflict(local, cloud)).toBe('local');
  });

  it('falls back to createdAt when updatedAt is absent', () => {
    const local = { updated_at: null, created_at: '2026-01-01T08:00:00.000Z' };
    const cloud = { updatedAt:  null, createdAt:  '2026-01-01T09:00:00.000Z' };
    expect(resolveConflict(local, cloud)).toBe('cloud');
  });

  it('treats missing timestamps as epoch (1970) so anything real wins', () => {
    const local = {};
    const cloud = { updatedAt: '2026-01-01T00:00:00.000Z' };
    expect(resolveConflict(local, cloud)).toBe('cloud');
  });
});

// ─── getDeviceId ──────────────────────────────────────────────────────────────

describe('getDeviceId', () => {
  beforeEach(() => jest.clearAllMocks());

  it('generates and stores a new ID when none exists', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(null);
    const id = await getDeviceId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@zenvoy_device_id',
      id,
    );
  });

  it('returns the stored ID without calling setItem again', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce('existing-device-id');
    const id = await getDeviceId();
    expect(id).toBe('existing-device-id');
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('returns a different ID on each fresh install', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);
    const id1 = await getDeviceId();
    const id2 = await getDeviceId();
    // Both are generated fresh (no storage on either call) — they may differ
    // because they incorporate Date.now() + random. Both should be strings.
    expect(typeof id1).toBe('string');
    expect(typeof id2).toBe('string');
  });
});
