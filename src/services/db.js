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
      synced      INTEGER DEFAULT 0
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
    "ALTER TABLE receipts ADD COLUMN category   TEXT DEFAULT 'Other'",
    "ALTER TABLE receipts ADD COLUMN status     TEXT DEFAULT 'ready'",
    "ALTER TABLE receipts ADD COLUMN notes      TEXT DEFAULT '[]'",
    "ALTER TABLE receipts ADD COLUMN updated_at TEXT",
  ]) {
    try { await database.execAsync(sql); } catch (_) { /* column exists */ }
  }

  // Backfill rows that predate the new columns
  await database.execAsync(`
    UPDATE receipts SET status     = 'ready'     WHERE status     IS NULL;
    UPDATE receipts SET notes      = '[]'        WHERE notes      IS NULL;
    UPDATE receipts SET updated_at = created_at  WHERE updated_at IS NULL;
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
       (vendor, date, total, tax, category, status, notes, photo_uri, created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    ]
  );
  return result.lastInsertRowId;
};

export const updateReceipt = async (id, receipt) => {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.runAsync(
    `UPDATE receipts
     SET vendor=?, date=?, total=?, tax=?, category=?, status=?, notes=?, updated_at=?
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
     SET vendor=?, date=?, total=?, tax=?, category=?, status=?, notes=?, updated_at=?
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

// --- Queue table operations ---

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
  const result = await database.runAsync(
    'UPDATE receipt_queue SET retry_count = retry_count + 1 WHERE id = ?',
    [id]
  );
  // Return new value by reading back
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

