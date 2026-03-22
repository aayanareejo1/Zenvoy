import * as SQLite from 'expo-sqlite';

let db;

export const getDb = async () => {
  if (!db) db = await SQLite.openDatabaseAsync('receiptsnap.db');
  return db;
};

export const initDb = async () => {
  const db = await getDb();
  await db.execAsync(`
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

  // Safe migrations for existing installs
  const migrations = [
    "ALTER TABLE receipts ADD COLUMN category TEXT DEFAULT 'Other'",
    "ALTER TABLE receipts ADD COLUMN status TEXT DEFAULT 'ready'",
    "ALTER TABLE receipts ADD COLUMN notes TEXT DEFAULT '[]'",
    "ALTER TABLE receipts ADD COLUMN updated_at TEXT",
  ];
  for (const sql of migrations) {
    try { await db.execAsync(sql); } catch (_) { /* column already exists */ }
  }

  // Backfill existing rows that predate the new columns
  await db.execAsync(`
    UPDATE receipts SET status = 'ready' WHERE status IS NULL;
    UPDATE receipts SET notes = '[]' WHERE notes IS NULL;
    UPDATE receipts SET updated_at = created_at WHERE updated_at IS NULL;
  `);
};

const serializeNotes = (notes) => JSON.stringify(Array.isArray(notes) ? notes : []);
const deserializeNotes = (raw) => { try { return JSON.parse(raw || '[]'); } catch { return []; } };

const deserialize = (row) => row ? { ...row, notes: deserializeNotes(row.notes) } : row;
const deserializeAll = (rows) => rows.map(deserialize);

// Routing: if vendor/date/total are missing/unusable → needs_review
export const deriveStatus = (receipt) => {
  const hasVendor = receipt.vendor && receipt.vendor !== 'Not found';
  const hasDate = receipt.date && receipt.date !== 'Not found';
  const hasTotal = receipt.total !== null && receipt.total !== undefined && parseFloat(receipt.total) > 0;
  return (hasVendor && hasDate && hasTotal) ? 'ready' : 'needs_review';
};

export const insertReceipt = async (receipt) => {
  const db = await getDb();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO receipts
      (vendor, date, total, tax, category, status, notes, photo_uri, created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      receipt.vendor || null,
      receipt.date || null,
      parseFloat(receipt.total) || 0,
      parseFloat(receipt.tax) || 0,
      receipt.category || 'Other',
      receipt.status || 'ready',
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
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM receipts ORDER BY date DESC, created_at DESC');
  return deserializeAll(rows);
};

export const getInboxReceipts = async () => {
  const db = await getDb();
  const rows = await db.getAllAsync(
    "SELECT * FROM receipts WHERE status = 'needs_review' ORDER BY created_at DESC"
  );
  return deserializeAll(rows);
};

export const updateReceipt = async (id, receipt) => {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE receipts
     SET vendor=?, date=?, total=?, tax=?, category=?, status=?, notes=?, updated_at=?
     WHERE id=?`,
    [
      receipt.vendor || null,
      receipt.date || null,
      parseFloat(receipt.total) || 0,
      parseFloat(receipt.tax) || 0,
      receipt.category || 'Other',
      receipt.status || 'ready',
      serializeNotes(receipt.notes),
      now,
      id,
    ]
  );
};

export const deleteReceipt = async (id) => {
  const db = await getDb();
  await db.runAsync('DELETE FROM receipts WHERE id=?', [id]);
};

export const getMonthlyCount = async () => {
  const db = await getDb();
  const month = new Date().toISOString().slice(0, 7);
  const result = await db.getFirstAsync(
    "SELECT COUNT(*) as count FROM receipts WHERE created_at LIKE ?",
    [`${month}%`]
  );
  return result?.count ?? 0;
};
