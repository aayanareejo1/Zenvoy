import * as SQLite from 'expo-sqlite';
import { deriveStatus, normalizeNotes } from '../utils/receiptHelpers';

// Re-export so existing callers (ScanScreen) don't need updating.
export { deriveStatus };

let db;

export const getDb = async () => {
  if (!db) db = await SQLite.openDatabaseAsync('receiptsnap.db');
  return db;
};

export const initDb = async () => {
  const database = await getDb();
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor TEXT,
      date TEXT,
      total REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      category TEXT DEFAULT 'Other',
      status TEXT DEFAULT 'ready',
      notes TEXT DEFAULT '[]',
      photo_uri TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      synced INTEGER DEFAULT 0
    );
  `);

  const migrations = [
    "ALTER TABLE receipts ADD COLUMN category TEXT DEFAULT 'Other'",
    "ALTER TABLE receipts ADD COLUMN status TEXT DEFAULT 'ready'",
    "ALTER TABLE receipts ADD COLUMN notes TEXT DEFAULT '[]'",
    "ALTER TABLE receipts ADD COLUMN updated_at TEXT",
  ];
  for (const sql of migrations) {
    try { await database.execAsync(sql); } catch (_) { /* column already exists */ }
  }

  // Backfill rows that predate the new columns
  await database.execAsync(`
    UPDATE receipts SET status = 'ready' WHERE status IS NULL;
    UPDATE receipts SET notes = '[]' WHERE notes IS NULL;
    UPDATE receipts SET updated_at = created_at WHERE updated_at IS NULL;
  `);
};

// --- Serialisation helpers ---

const serializeNotes = (notes) => JSON.stringify(normalizeNotes(notes));

const deserialize = (row) => {
  if (!row) return row;
  try { row.notes = JSON.parse(row.notes || '[]'); } catch { row.notes = []; }
  return row;
};
const deserializeAll = (rows) => rows.map(deserialize);

// --- Query helpers ---

export const insertReceipt = async (receipt) => {
  const database = await getDb();
  const now = new Date().toISOString();
  const result = await database.runAsync(
    `INSERT INTO receipts
       (vendor, date, total, tax, category, status, notes, photo_uri, created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      receipt.vendor  || null,
      receipt.date    || null,
      parseFloat(receipt.total) || 0,
      parseFloat(receipt.tax)   || 0,
      receipt.category || 'Other',
      receipt.status   || 'ready',
      serializeNotes(receipt.notes),
      receipt.photo_uri || null,
      receipt.created_at || now,
      now,
      0,
    ]
  );
  return result.lastInsertRowId;
};

export const getAllReceipts = async () => {
  const database = await getDb();
  const rows = await database.getAllAsync(
    'SELECT * FROM receipts ORDER BY date DESC, created_at DESC'
  );
  return deserializeAll(rows);
};

/** Only receipts the user has confirmed/approved. */
export const getReadyReceipts = async () => {
  const database = await getDb();
  const rows = await database.getAllAsync(
    "SELECT * FROM receipts WHERE status = 'ready' ORDER BY date DESC, created_at DESC"
  );
  return deserializeAll(rows);
};

/** Receipts awaiting manual review. */
export const getInboxReceipts = async () => {
  const database = await getDb();
  const rows = await database.getAllAsync(
    "SELECT * FROM receipts WHERE status = 'needs_review' ORDER BY created_at DESC"
  );
  return deserializeAll(rows);
};

export const updateReceipt = async (id, receipt) => {
  const database = await getDb();
  const now = new Date().toISOString();
  await database.runAsync(
    `UPDATE receipts
     SET vendor=?, date=?, total=?, tax=?, category=?, status=?, notes=?, updated_at=?
     WHERE id=?`,
    [
      receipt.vendor  || null,
      receipt.date    || null,
      parseFloat(receipt.total) || 0,
      parseFloat(receipt.tax)   || 0,
      receipt.category || 'Other',
      receipt.status   || 'ready',
      serializeNotes(receipt.notes),
      now,
      id,
    ]
  );
};

export const deleteReceipt = async (id) => {
  const database = await getDb();
  await database.runAsync('DELETE FROM receipts WHERE id=?', [id]);
};

export const getMonthlyCount = async () => {
  const database = await getDb();
  const month = new Date().toISOString().slice(0, 7);
  const result = await database.getFirstAsync(
    "SELECT COUNT(*) as count FROM receipts WHERE created_at LIKE ?",
    [`${month}%`]
  );
  return result?.count ?? 0;
};
