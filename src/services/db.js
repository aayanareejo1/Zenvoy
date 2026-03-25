import * as SQLite from 'expo-sqlite';
import { deriveStatus, normalizeNotes } from '../utils/receiptHelpers';

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
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor       TEXT,
      date         TEXT,
      total        REAL    NOT NULL DEFAULT 0,
      tax          REAL    NOT NULL DEFAULT 0,
      category     TEXT    DEFAULT 'Other',
      status       TEXT    DEFAULT 'ready',
      notes        TEXT    DEFAULT '[]',
      photo_uri    TEXT,
      created_at   TEXT    NOT NULL,
      updated_at   TEXT,
      synced       INTEGER DEFAULT 0,
      version      INTEGER DEFAULT 1,
      device_id    TEXT,
      firestore_id TEXT
    );

    CREATE TABLE IF NOT EXISTS receipt_queue (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_id   INTEGER NOT NULL,
      photo_uri    TEXT    NOT NULL,
      status       TEXT    NOT NULL DEFAULT 'pending',
      attempts     INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS failed_syncs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_id    INTEGER NOT NULL,
      operation     TEXT,
      error         TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 1,
      failed_at     TEXT    NOT NULL
    );
  `);

  // Safe migrations for installs that predate these columns
  for (const sql of [
    "ALTER TABLE receipts ADD COLUMN category     TEXT    DEFAULT 'Other'",
    "ALTER TABLE receipts ADD COLUMN status       TEXT    DEFAULT 'ready'",
    "ALTER TABLE receipts ADD COLUMN notes        TEXT    DEFAULT '[]'",
    "ALTER TABLE receipts ADD COLUMN updated_at   TEXT",
    "ALTER TABLE receipts ADD COLUMN synced       INTEGER DEFAULT 0",
    "ALTER TABLE receipts ADD COLUMN version      INTEGER DEFAULT 1",
    "ALTER TABLE receipts ADD COLUMN device_id    TEXT",
    "ALTER TABLE receipts ADD COLUMN firestore_id TEXT",
    "ALTER TABLE receipts ADD COLUMN tags         TEXT    DEFAULT '[]'",
    "ALTER TABLE receipts ADD COLUMN ocr_confidence INTEGER DEFAULT NULL",
  ]) {
    try { await database.execAsync(sql); } catch (_) { /* column exists */ }
  }

  // Backfill rows that predate new columns
  await database.execAsync(`
    UPDATE receipts SET status     = 'ready'    WHERE status     IS NULL;
    UPDATE receipts SET notes      = '[]'       WHERE notes      IS NULL;
    UPDATE receipts SET updated_at = created_at WHERE updated_at IS NULL;
    UPDATE receipts SET synced     = 0          WHERE synced     IS NULL;
    UPDATE receipts SET version    = 1          WHERE version    IS NULL;
  `);

  // Indexes for query performance
  for (const sql of [
    'CREATE INDEX IF NOT EXISTS idx_receipts_status     ON receipts(status)',
    'CREATE INDEX IF NOT EXISTS idx_receipts_date       ON receipts(date)',
    'CREATE INDEX IF NOT EXISTS idx_receipts_created_at ON receipts(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_receipts_synced     ON receipts(synced)',
    'CREATE INDEX IF NOT EXISTS idx_queue_status        ON receipt_queue(status)',
  ]) {
    try { await database.execAsync(sql); } catch (_) { /* index exists */ }
  }
};

// --- Serialisation helpers (module-private) ---

const ser   = (notes) => JSON.stringify(normalizeNotes(notes));
const deser = (row) => {
  if (!row) return row;
  try { row.notes = JSON.parse(row.notes || '[]'); } catch { row.notes = []; }
  try { row.tags  = JSON.parse(row.tags  || '[]'); } catch { row.tags  = []; }
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
     SET vendor=?, date=?, total=?, tax=?, category=?, status=?, notes=?,
         updated_at=?, synced=0, version=version+1
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

/** Soft-delete: marks status='deleted' and flags for cloud sync. */
export const softDeleteReceipt = async (id) => {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.runAsync(
    `UPDATE receipts SET status='deleted', synced=0, updated_at=?, version=version+1 WHERE id=?`,
    [now, id]
  );
};

// --- Reads ---

export const getReceiptById = async (id) => {
  const database = await getDb();
  const row = await database.getFirstAsync('SELECT * FROM receipts WHERE id=?', [id]);
  return deser(row) ?? null;
};

export const getAllReceipts = async () => {
  const database = await getDb();
  return deserAll(await database.getAllAsync(
    'SELECT * FROM receipts ORDER BY date DESC, created_at DESC'
  ));
};

/** Single most-recent receipt — used for the Scan screen "Recent" card. */
export const getLatestReceipt = async () => {
  const database = await getDb();
  const row = await database.getFirstAsync(
    'SELECT * FROM receipts ORDER BY date DESC, created_at DESC LIMIT 1'
  );
  return deser(row) ?? null;
};

/** Receipts shown in the main list — only ready. */
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

// --- Sync helpers ---

export const getUnsyncedReceipts = async () => {
  const database = await getDb();
  return deserAll(await database.getAllAsync(
    "SELECT * FROM receipts WHERE synced = 0 ORDER BY updated_at ASC"
  ));
};

export const markReceiptSynced = async (id, firestoreId, version) => {
  const database = await getDb();
  if (version != null) {
    await database.runAsync(
      'UPDATE receipts SET synced=1, firestore_id=COALESCE(?, firestore_id), version=? WHERE id=?',
      [firestoreId || null, version, id]
    );
  } else {
    await database.runAsync(
      'UPDATE receipts SET synced=1, firestore_id=COALESCE(?, firestore_id) WHERE id=?',
      [firestoreId || null, id]
    );
  }
};

// --- Queue helpers ---

export const insertQueueItem = async (receiptId, photoUri) => {
  const database = await getDb();
  const now = new Date().toISOString();
  const result = await database.runAsync(
    'INSERT INTO receipt_queue (receipt_id, photo_uri, status, attempts, created_at) VALUES (?, ?, ?, ?, ?)',
    [receiptId, photoUri, 'pending', 0, now]
  );
  return result.lastInsertRowId;
};

export const getQueueItems = async (status = 'pending') => {
  const database = await getDb();
  return database.getAllAsync(
    'SELECT * FROM receipt_queue WHERE status=? ORDER BY created_at ASC',
    [status]
  );
};

export const updateQueueItemStatus = async (id, status, attempts) => {
  const database = await getDb();
  await database.runAsync(
    'UPDATE receipt_queue SET status=?, attempts=? WHERE id=?',
    [status, attempts, id]
  );
};

export const deleteQueueItem = async (id) => {
  const database = await getDb();
  await database.runAsync('DELETE FROM receipt_queue WHERE id=?', [id]);
};

// --- Failed sync log ---

export const insertFailedSync = async (receiptId, error, operation) => {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.runAsync(
    'INSERT INTO failed_syncs (receipt_id, operation, error, attempt_count, failed_at) VALUES (?, ?, ?, 1, ?)',
    [receiptId, operation || null, error || null, now]
  );
};

export const getFailedSyncs = async () => {
  const database = await getDb();
  return database.getAllAsync('SELECT * FROM failed_syncs ORDER BY failed_at DESC');
};

export const deleteFailedSync = async (id) => {
  const database = await getDb();
  await database.runAsync('DELETE FROM failed_syncs WHERE id=?', [id]);
};

export const incrementFailedSyncAttempt = async (id) => {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.runAsync(
    'UPDATE failed_syncs SET attempt_count = attempt_count + 1, failed_at = ? WHERE id=?',
    [now, id]
  );
};

/** Set failed_syncs.attempt_count to a specific value (used by syncService retry loop). */
export const updateFailedSyncAttempt = async (id, count) => {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.runAsync(
    'UPDATE failed_syncs SET attempt_count = ?, failed_at = ? WHERE id=?',
    [count, now, id]
  );
};

// --- Cloud sync helpers ---

/** Insert a receipt that arrived from Firestore; marks it as already synced. */
export const insertReceiptFromCloud = async (receipt) => {
  const database = await getDb();
  const now = new Date().toISOString();
  const result = await database.runAsync(
    `INSERT INTO receipts
       (vendor, date, total, tax, category, status, notes, photo_uri,
        created_at, updated_at, synced, version, device_id, firestore_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      1,
      receipt.version      || 1,
      receipt.device_id    || null,
      receipt.firestore_id || null,
    ]
  );
  return result.lastInsertRowId;
};

/** Update a local receipt with cloud data; marks it as synced and sets the authoritative version. */
export const updateReceiptFromCloud = async (id, fields, firestoreId, version) => {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.runAsync(
    `UPDATE receipts
     SET vendor=?, date=?, total=?, tax=?, category=?, status=?, notes=?,
         updated_at=?, synced=1, version=?, firestore_id=COALESCE(?, firestore_id)
     WHERE id=?`,
    [
      fields.vendor    || null,
      fields.date      || null,
      parseFloat(fields.total)  || 0,
      parseFloat(fields.tax)    || 0,
      fields.category  || 'Other',
      fields.status    || 'ready',
      ser(fields.notes),
      now,
      version          || 1,
      firestoreId      || null,
      id,
    ]
  );
};

// --- Queue aliases & additions ---

/** Alias kept for callers that use the "Entry" naming convention. */
export const insertQueueEntry = (receiptId, photoUri) => insertQueueItem(receiptId, photoUri);

/** Alias kept for callers that use the "Entry" naming convention. */
export const getQueueEntries = (status = 'pending') => getQueueItems(status);

/** Generic update for a queue row — only touches columns that exist in the schema. */
export const updateQueueEntry = async (id, updates) => {
  const database = await getDb();
  if (updates.status != null) {
    await database.runAsync(
      'UPDATE receipt_queue SET status=? WHERE id=?',
      [updates.status, id]
    );
  }
};

/** Increment the retry counter (attempts column) for a queue entry. */
export const incrementQueueRetryCount = async (id) => {
  const database = await getDb();
  await database.runAsync(
    'UPDATE receipt_queue SET attempts = attempts + 1 WHERE id=?',
    [id]
  );
};

/** Fetch a single queue row by its id. */
export const getQueueEntryById = async (id) => {
  const database = await getDb();
  return database.getFirstAsync('SELECT * FROM receipt_queue WHERE id=?', [id]);
};

/** Fetch all queue rows regardless of status. */
export const getAllQueueEntries = async () => {
  const database = await getDb();
  return database.getAllAsync('SELECT * FROM receipt_queue ORDER BY created_at ASC');
};
