import { getDb } from './db';

const where = (dateFrom, dateTo) => {
  const parts = ["status = 'ready'"];
  if (dateFrom) parts.push(`date >= '${dateFrom}'`);
  if (dateTo)   parts.push(`date <= '${dateTo}'`);
  return parts.join(' AND ');
};

export const getExpenseSummary = async (dateFrom, dateTo) => {
  const database = await getDb();
  const row = await database.getFirstAsync(
    `SELECT
       COALESCE(SUM(total), 0)            AS totalExpense,
       COALESCE(SUM(tax),   0)            AS totalTax,
       COUNT(*)                           AS count,
       COALESCE(AVG(total), 0)            AS avgPerReceipt
     FROM receipts WHERE ${where(dateFrom, dateTo)}`
  );
  return {
    totalExpense:  parseFloat(row?.totalExpense  || 0),
    totalTax:      parseFloat(row?.totalTax      || 0),
    count:         row?.count      || 0,
    avgPerReceipt: parseFloat(row?.avgPerReceipt || 0),
  };
};

export const getExpenseByCategory = async (dateFrom, dateTo) => {
  const database = await getDb();
  const rows = await database.getAllAsync(
    `SELECT
       COALESCE(category, 'Other') AS cat,
       SUM(total)                  AS total,
       SUM(tax)                    AS tax,
       COUNT(*)                    AS count
     FROM receipts
     WHERE ${where(dateFrom, dateTo)}
     GROUP BY cat
     ORDER BY total DESC`
  );
  const result = {};
  for (const r of rows) {
    result[r.cat] = {
      total: parseFloat(r.total || 0),
      tax:   parseFloat(r.tax   || 0),
      count: r.count,
    };
  }
  return result;
};

/** Returns { "2026-03": { total, count }, ... } for the last `months` calendar months. */
export const getMonthlyTrend = async (months = 6) => {
  const database = await getDb();
  const rows = await database.getAllAsync(
    `SELECT
       substr(date, 1, 7) AS month,
       SUM(total)         AS total,
       COUNT(*)           AS count
     FROM receipts
     WHERE status = 'ready' AND date IS NOT NULL
     GROUP BY month
     ORDER BY month DESC
     LIMIT ?`,
    [months]
  );
  const result = {};
  for (const r of rows) {
    result[r.month] = { total: parseFloat(r.total || 0), count: r.count };
  }
  return result;
};

const DEDUCTIBLE_CATEGORIES = ['Business', 'Office', 'Travel', 'Meals'];

export const getTaxDeductible = async (dateFrom, dateTo) => {
  const database = await getDb();
  const placeholders = DEDUCTIBLE_CATEGORIES.map(() => '?').join(', ');
  const rows = await database.getAllAsync(
    `SELECT
       COALESCE(category, 'Other') AS cat,
       SUM(total)                  AS total,
       COUNT(*)                    AS count
     FROM receipts
     WHERE ${where(dateFrom, dateTo)}
       AND category IN (${placeholders})
     GROUP BY cat
     ORDER BY total DESC`,
    DEDUCTIBLE_CATEGORIES
  );
  const result = {};
  for (const r of rows) {
    result[r.cat] = { total: parseFloat(r.total || 0), count: r.count };
  }
  return result;
};

export const getTopSpendingDays = async (dateFrom, dateTo, limit = 5) => {
  const database = await getDb();
  return database.getAllAsync(
    `SELECT
       date,
       SUM(total) AS total,
       COUNT(*)   AS count
     FROM receipts
     WHERE ${where(dateFrom, dateTo)} AND date IS NOT NULL
     GROUP BY date
     ORDER BY total DESC
     LIMIT ?`,
    [limit]
  );
};

export const getTopVendors = async (dateFrom, dateTo, limit = 5) => {
  const database = await getDb();
  return database.getAllAsync(
    `SELECT
       vendor,
       SUM(total) AS total,
       COUNT(*)   AS count
     FROM receipts
     WHERE ${where(dateFrom, dateTo)} AND vendor IS NOT NULL
     GROUP BY vendor
     ORDER BY count DESC, total DESC
     LIMIT ?`,
    [limit]
  );
};
