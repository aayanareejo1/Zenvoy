import * as SQLite from 'expo-sqlite';
import { deriveStatus, normalizeNotes } from '../utils/receiptHelpers';

// Re-export so existing callers don't need to change their imports.
export { deriveStatus };

let db;

export const getDb = async () => {
  if (!db) db = await SQLite.openDatabaseAsync('zenvoy.db');
  return db;
};

export const initDb = async () => {
  const database = await getDb();
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS receipts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor      TEXT,
      date        TEXT,
      total       REAL    NOT NULL DEFAULT 0,
      tax         REAL    NOT NULL DEFAULT 0,
      category    TEXT    DEFAULT 'Other',
      status      TEXT    DEFAULT 'ready',
      notes       TEXT    DEFAULT '[]',
      photo_uri   TEXT,
      created_at  TEXT    NOT NULL,
      updated_at  TEXT,
      synced      INTEGER DEFAULT 0,
      version     INTEGER DEFAULT 1,
      device_id   TEXT,
      firestore_id TEXT
    );
  `);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS failed_syncs (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_id       INTEGER NOT NULL,
      operation        TEXT,
      error_message    TEXT,
      attempt_count    INTEGER NOT NULL DEFAULT 1,
      last_attempted   TEXT,
      last_attempt_at  TEXT,
      created_at       TEXT    NOT NULL
    );
    CREATE TABLE IF NOT EXISTS receipt_queue (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_id    INTEGER NOT NULL,
      photo_uri     TEXT    NOT NULL,
      status        TEXT    NOT NULL DEFAULT 'pending',
      error_message TEXT,
      retry_count   INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT    NOT NULL,
      started_at    TEXT,
      completed_at  TEXT,
      result        TEXT
    );
  `);

  // Safe migrations for installs that predate these columns
  for (const sql of [
    "ALTER TABLE receipts ADD COLUMN category     TEXT DEFAULT 'Other'",
    "ALTER TABLE receipts ADD COLUMN status       TEXT DEFAULT 'ready'",
    "ALTER TABLE receipts ADD COLUMN notes        TEXT DEFAULT '[]'",
    "ALTER TABLE receipts ADD COLUMN updated_at   TEXT",
    "ALTER TABLE receipts ADD COLUMN version      INTEGER DEFAULT 1",
    "ALTER TABLE receipts ADD COLUMN device_id    TEXT",
    "ALTER TABLE receipts ADD COLUMN firestore_id TEXT",
  ]) {
    try { await database.execAsync(sql); } catch (_) { /* column exists */ }
  }

  // Backfill rows that predate the new columns
  await database.execAsync(`
    UPDATE receipts SET status     = 'ready'     WHERE status     IS NULL;
    UPDATE receipts SET notes      = '[]'        WHERE notes      IS NULL;
    UPDATE receipts SET updated_at = created_at  WHERE updated_at IS NULL;
    UPDATE receipts SET version    = 1           WHERE version    IS NULL;
  `);
};

// --- Serialisation helpers (module-private) ---

const ser   = (notes) => JSON.stringify(normalizeNotes(notes));
const deser = (row) => {
  if (!row) return row;
  try { row.notes = JSON.parse(row.notes || '[]'); } catch { row.notes = []; }
  return row;
};
const deserAll = (rows) => rows.map(deser);

// --- Writes ---

export const insertReceipt = async (receipt) => {
  const database = await getDb();
  const now = new Date().toISOString();
  const result = await database.runAsync(
    `INSERT INTO receipts
       (vendor, date, total, tax, category, status, notes, photo_uri, created_at, updated_at, synced, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      receipt.vendor   || null,
      receipt.date     || null,
      parseFloat(receipt.total)  || 0,
      parseFloat(receipt.tax)    || 0,
      receipt.category || 'Other',
      receipt.status   || 'ready',
      ser(receipt.notes),
      receipt.photo_uri || null,
      receipt.created_at || now,
      now,
      0,
      1,
    ]
  );
  return result.lastInsertRowId;
};

export const updateReceipt = async (id, receipt) => {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.runAsync(
    `UPDATE receipts
     SET vendor=?, date=?, total=?, tax=?, category=?, status=?, notes=?, updated_at=?, synced=0, version=version+1
     WHERE id=?`,
    [
      receipt.vendor   || null,
      receipt.date     || null,
      parseFloat(receipt.total)  || 0,
      parseFloat(receipt.tax)    || 0,
      receipt.category || 'Other',
      receipt.status   || 'ready',
      ser(receipt.notes),
      now,
      id,
    ]
  );
};

/** Lightweight update used by the queue worker — only touches status and extracted fields. */
export const updateReceiptFromScan = async (id, fields) => {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.runAsync(
    `UPDATE receipts
     SET vendor=?, date=?, total=?, tax=?, category=?, status=?, notes=?, updated_at=?, synced=0
     WHERE id=?`,
    [
      fields.vendor   || null,
      fields.date     || null,
      parseFloat(fields.total)  || 0,
      parseFloat(fields.tax)    || 0,
      fields.category || 'Other',
      fields.status   || 'ready',
      ser(fields.notes),
      now,
      id,
    ]
  );
};

export const deleteReceipt = async (id) => {
  const database = await getDb();
  await database.runAsync('DELETE FROM receipts WHERE id=?', [id]);
};

/** Soft-delete: marks the receipt as deleted and flags it for cloud sync. */
export const softDeleteReceipt = async (id) => {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.runAsync(
    `UPDATE receipts SET status='deleted', synced=0, updated_at=?, version=version+1 WHERE id=?`,
    [now, id]
  );
};

// --- Reads ---

export const getAllReceipts = async () => {
  const database = await getDb();
  return deserAll(await database.getAllAsync(
    'SELECT * FROM receipts ORDER BY date DESC, created_at DESC'
  ));
};

/** Single most-recent receipt by date then created_at — used for the Scan screen "Recent" card. */
export const getLatestReceipt = async () => {
  const database = await getDb();
  const row = await database.getFirstAsync(
    'SELECT * FROM receipts ORDER BY date DESC, created_at DESC LIMIT 1'
  );
  return deser(row) ?? null;
};

/** Fetch a single receipt by primary key. */
export const getReceiptById = async (id) => {
  const database = await getDb();
  const row = await database.getFirstAsync('SELECT * FROM receipts WHERE id=?', [id]);
  return deser(row) ?? null;
};

/** Receipts shown in the main list — only confirmed/reviewed. */
export const getReadyReceipts = async () => {
  const database = await getDb();
  return deserAll(await database.getAllAsync(
    "SELECT * FROM receipts WHERE status = 'ready' ORDER BY date DESC, created_at DESC"
  ));
};

/** Receipts awaiting manual review. */
export const getInboxReceipts = async () => {
  const database = await getDb();
  return deserAll(await database.getAllAsync(
    "SELECT * FROM receipts WHERE status = 'needs_review' ORDER BY created_at DESC"
  ));
};

/** Count of inbox items — used for the tab badge. */
export const getInboxCount = async () => {
  const database = await getDb();
  const row = await database.getFirstAsync(
    "SELECT COUNT(*) as count FROM receipts WHERE status = 'needs_review'"
  );
  return row?.count ?? 0;
};

/**
 * Count of AI-scanned receipts this calendar month.
 * Only counts rows with a photo_uri (proxy for "went through Claude").
 */
export const getMonthlyCount = async () => {
  const database = await getDb();
  const month = new Date().toISOString().slice(0, 7);
  const row = await database.getFirstAsync(
    "SELECT COUNT(*) as count FROM receipts WHERE created_at LIKE ? AND photo_uri IS NOT NULL",
    [`${month}%`]
  );
  return row?.count ?? 0;
};

// --- Sync helpers (Priority 2) ---

/** Get all receipts that have not yet been pushed to cloud. */
export const getUnsynced = async () => {
  const database = await getDb();
  return deserAll(await database.getAllAsync(
    'SELECT * FROM receipts WHERE synced=0'
  ));
};

/**
 * Mark a receipt as synced, recording its Firestore doc ID and version.
 * Called after a successful push or pull update.
 */
export const markReceiptSynced = async (id, firestoreId, version) => {
  const database = await getDb();
  await database.runAsync(
    'UPDATE receipts SET synced=1, firestore_id=?, version=? WHERE id=?',
    [firestoreId, version, id]
  );
};

/** Update the version field of a receipt without touching anything else. */
export const updateReceiptVersion = async (receiptId, newVersion) => {
  const database = await getDb();
  await database.runAsync(
    'UPDATE receipts SET version=? WHERE id=?',
    [newVersion, receiptId]
  );
};

/**
 * Insert a receipt that originated in Firestore (pull sync).
 * Sets synced=1 immediately so it is not pushed back up.
 */
export const insertReceiptFromCloud = async (receipt) => {
  const database = await getDb();
  const now = new Date().toISOString();
  const result = await database.runAsync(
    `INSERT INTO receipts
       (vendor, date, total, tax, category, status, notes, photo_uri,
        created_at, updated_at, synced, version, device_id, firestore_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    [
      receipt.vendor       || null,
      receipt.date         || null,
      parseFloat(receipt.total)  || 0,
      parseFloat(receipt.tax)    || 0,
      receipt.category     || 'Other',
      receipt.status       || 'ready',
      ser(receipt.notes),
      receipt.photo_uri    || null,
      receipt.created_at   || now,
      receipt.updated_at   || now,
      receipt.version      || 1,
      receipt.device_id    || null,
      receipt.firestore_id || null,
    ]
  );
  return result.lastInsertRowId;
};

/**
 * Update a receipt with cloud data without resetting the synced flag.
 * Used during pull sync so the receipt is not immediately queued for re-push.
 */
export const updateReceiptFromCloud = async (id, fields, firestoreId, version) => {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.runAsync(
    `UPDATE receipts
     SET vendor=?, date=?, total=?, tax=?, category=?, status=?, notes=?,
         updated_at=?, synced=1, firestore_id=?, version=?
     WHERE id=?`,
    [
      fields.vendor   || null,
      fields.date     || null,
      parseFloat(fields.total)  || 0,
      parseFloat(fields.tax)    || 0,
      fields.category || 'Other',
      fields.status   || 'ready',
      ser(fields.notes),
      now,
      firestoreId,
      version,
      id,
    ]
  );
};

// --- Failed sync queue (Priority 2 & 4) ---

export const FAILED_SYNC_RETRY_LIMIT = 5;

export const insertFailedSync = async (receiptId, operation, errorMsg) => {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.runAsync(
    `INSERT INTO failed_syncs (receipt_id, operation, error_message, attempt_count, last_attempted, created_at)
     VALUES (?, ?, ?, 1, ?, ?)`,
    [receiptId, operation, errorMsg || null, now, now]
  );
};

/** Get queued failures that have not yet exceeded the retry limit. */
export const getFailedSyncs = async () => {
  const database = await getDb();
  return database.getAllAsync(
    `SELECT fs.*, r.vendor, r.date, r.total
     FROM failed_syncs fs
     LEFT JOIN receipts r ON r.id = fs.receipt_id
     WHERE fs.attempt_count < ${FAILED_SYNC_RETRY_LIMIT}
     ORDER BY fs.created_at DESC`
  );
};

export const updateFailedSyncAttempt = async (failedSyncId, attemptCount) => {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.runAsync(
    'UPDATE failed_syncs SET attempt_count=?, last_attempted=? WHERE id=?',
    [attemptCount, now, failedSyncId]
  );
};

export const deleteFailedSync = async (id) => {
  const database = await getDb();
  await database.runAsync('DELETE FROM failed_syncs WHERE id=?', [id]);
};

export const incrementFailedSyncAttempt = async (id) => {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.runAsync(
    `UPDATE failed_syncs SET attempt_count = attempt_count + 1, last_attempt_at = ? WHERE id = ?`,
    [now, id]
  );
};

// --- Queue table operations (Priority 1) ---

export const insertQueueEntry = async (receiptId, photoUri) => {
  const database = await getDb();
  const now = new Date().toISOString();
  const result = await database.runAsync(
    `INSERT INTO receipt_queue (receipt_id, photo_uri, status, retry_count, created_at)
     VALUES (?, ?, 'pending', 0, ?)`,
    [receiptId, photoUri, now]
  );
  return result.lastInsertRowId;
};

export const getQueueEntries = async (status) => {
  const database = await getDb();
  if (status) {
    return database.getAllAsync(
      'SELECT * FROM receipt_queue WHERE status = ? ORDER BY created_at ASC',
      [status]
    );
  }
  return database.getAllAsync('SELECT * FROM receipt_queue ORDER BY created_at ASC');
};

export const getAllQueueEntries = async () => {
  const database = await getDb();
  return database.getAllAsync('SELECT * FROM receipt_queue ORDER BY created_at ASC');
};

export const updateQueueEntry = async (id, updates) => {
  const database = await getDb();
  const fields = [];
  const values = [];
  for (const [key, val] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(val);
  }
  values.push(id);
  await database.runAsync(
    `UPDATE receipt_queue SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
};

export const deleteQueueEntry = async (id) => {
  const database = await getDb();
  await database.runAsync('DELETE FROM receipt_queue WHERE id = ?', [id]);
};

export const incrementQueueRetryCount = async (id) => {
  const database = await getDb();
  await database.runAsync(
    'UPDATE receipt_queue SET retry_count = retry_count + 1 WHERE id = ?',
    [id]
  );
  const row = await database.getFirstAsync(
    'SELECT retry_count FROM receipt_queue WHERE id = ?',
    [id]
  );
  return row?.retry_count ?? 0;
};

export const getQueueEntryById = async (id) => {
  const database = await getDb();
  return database.getFirstAsync('SELECT * FROM receipt_queue WHERE id = ?', [id]);
};