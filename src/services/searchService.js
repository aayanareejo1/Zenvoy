import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDb } from './db';

const FILTERS_KEY = 'saved_filters';
const RECENT_KEY  = 'recent_searches';

// ─── Full-text search ────────────────────────────────────────────────────────────

export const searchReceipts = async (query) => {
  if (!query || !query.trim()) return [];
  const database = await getDb();
  const q = `%${query.trim().toLowerCase()}%`;
  const rows = await database.getAllAsync(
    `SELECT * FROM receipts
     WHERE status = 'ready'
       AND (
         lower(vendor)   LIKE ? OR
         lower(category) LIKE ? OR
         lower(notes)    LIKE ? OR
         lower(date)     LIKE ?
       )
     ORDER BY date DESC, created_at DESC`,
    [q, q, q, q]
  );
  return rows.map(deserRow);
};

// ─── Filter ──────────────────────────────────────────────────────────────────────

export const filterReceipts = async ({
  categories = [],
  dateFrom,
  dateTo,
  minAmount,
  maxAmount,
  vendors = [],
  tags = [],
} = {}) => {
  const database = await getDb();
  const parts = ["status = 'ready'"];
  const args  = [];

  if (categories.length) {
    const ph = categories.map(() => '?').join(', ');
    parts.push(`category IN (${ph})`);
    args.push(...categories);
  }
  if (dateFrom) { parts.push(`date >= ?`); args.push(dateFrom); }
  if (dateTo)   { parts.push(`date <= ?`); args.push(dateTo);   }
  if (minAmount != null) { parts.push(`total >= ?`); args.push(minAmount); }
  if (maxAmount != null) { parts.push(`total <= ?`); args.push(maxAmount); }
  if (vendors.length) {
    const ph = vendors.map(() => 'lower(vendor) = ?').join(' OR ');
    parts.push(`(${ph})`);
    args.push(...vendors.map(v => v.toLowerCase()));
  }

  const rows = await database.getAllAsync(
    `SELECT * FROM receipts WHERE ${parts.join(' AND ')} ORDER BY date DESC, created_at DESC`,
    args
  );

  let results = rows.map(deserRow);

  // Tags filter is in-memory (JSON field)
  if (tags.length) {
    results = results.filter(r => {
      const rTags = r.tags || [];
      return tags.every(t => rTags.includes(t));
    });
  }

  return results;
};

// ─── Saved filters ───────────────────────────────────────────────────────────────

export const saveFilter = async (name, filterObject) => {
  const existing = await getSavedFilters();
  existing[name] = filterObject;
  await AsyncStorage.setItem(FILTERS_KEY, JSON.stringify(existing));
};

export const getSavedFilters = async () => {
  try {
    const raw = await AsyncStorage.getItem(FILTERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

export const deleteFilter = async (name) => {
  const existing = await getSavedFilters();
  delete existing[name];
  await AsyncStorage.setItem(FILTERS_KEY, JSON.stringify(existing));
};

// ─── Recent searches ─────────────────────────────────────────────────────────────

export const addRecentSearch = async (query) => {
  if (!query?.trim()) return;
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    let recent = raw ? JSON.parse(raw) : [];
    recent = [query, ...recent.filter(r => r !== query)].slice(0, 10);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  } catch {}
};

export const getRecentSearches = async () => {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

export const clearRecentSearches = async () => {
  await AsyncStorage.removeItem(RECENT_KEY);
};

// ─── Tags ────────────────────────────────────────────────────────────────────────

export const addTagToReceipt = async (receiptId, tag) => {
  const database = await getDb();
  const row = await database.getFirstAsync('SELECT tags FROM receipts WHERE id=?', [receiptId]);
  let tags = [];
  try { tags = JSON.parse(row?.tags || '[]'); } catch {}
  if (!tags.includes(tag)) tags.push(tag);
  await database.runAsync('UPDATE receipts SET tags=?, synced=0 WHERE id=?', [JSON.stringify(tags), receiptId]);
};

export const removeTagFromReceipt = async (receiptId, tag) => {
  const database = await getDb();
  const row = await database.getFirstAsync('SELECT tags FROM receipts WHERE id=?', [receiptId]);
  let tags = [];
  try { tags = JSON.parse(row?.tags || '[]'); } catch {}
  tags = tags.filter(t => t !== tag);
  await database.runAsync('UPDATE receipts SET tags=?, synced=0 WHERE id=?', [JSON.stringify(tags), receiptId]);
};

export const getAllTags = async () => {
  const database = await getDb();
  const rows = await database.getAllAsync('SELECT tags FROM receipts WHERE tags IS NOT NULL AND tags != ?', ['[]']);
  const tagSet = new Set();
  for (const r of rows) {
    try {
      const arr = JSON.parse(r.tags || '[]');
      arr.forEach(t => tagSet.add(t));
    } catch {}
  }
  return [...tagSet].sort();
};

// ─── Helpers ─────────────────────────────────────────────────────────────────────

function deserRow(row) {
  if (!row) return row;
  try { row.notes = JSON.parse(row.notes || '[]'); } catch { row.notes = []; }
  try { row.tags  = JSON.parse(row.tags  || '[]'); } catch { row.tags  = []; }
  return row;
}
