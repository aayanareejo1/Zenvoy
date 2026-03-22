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
      vendor TEXT NOT NULL,
      date TEXT NOT NULL,
      total REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      category TEXT DEFAULT 'Other',
      photo_uri TEXT,
      created_at TEXT NOT NULL,
      synced INTEGER DEFAULT 0
    );
  `);
  // Migration: add category column if upgrading from older schema
  try {
    await db.execAsync("ALTER TABLE receipts ADD COLUMN category TEXT DEFAULT 'Other'");
  } catch (_) {
    // Column already exists — ignore
  }
};

export const insertReceipt = async (receipt) => {
  const db = await getDb();
  const result = await db.runAsync(
    'INSERT INTO receipts (vendor, date, total, tax, category, photo_uri, created_at, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [receipt.vendor, receipt.date, receipt.total, receipt.tax, receipt.category || 'Other', receipt.photo_uri || null, receipt.created_at, 0]
  );
  return result.lastInsertRowId;
};

export const getAllReceipts = async () => {
  const db = await getDb();
  return await db.getAllAsync('SELECT * FROM receipts ORDER BY date DESC, created_at DESC');
};

export const updateReceipt = async (id, receipt) => {
  const db = await getDb();
  await db.runAsync(
    'UPDATE receipts SET vendor=?, date=?, total=?, tax=?, category=? WHERE id=?',
    [receipt.vendor, receipt.date, receipt.total, receipt.tax, receipt.category || 'Other', id]
  );
};

export const deleteReceipt = async (id) => {
  const db = await getDb();
  await db.runAsync('DELETE FROM receipts WHERE id=?', [id]);
};

export const getMonthlyCount = async () => {
  const db = await getDb();
  const month = new Date().toISOString().slice(0, 7); // "2025-03"
  const result = await db.getFirstAsync(
    "SELECT COUNT(*) as count FROM receipts WHERE created_at LIKE ?",
    [`${month}%`]
  );
  return result?.count ?? 0;
};
