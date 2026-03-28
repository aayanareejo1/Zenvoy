import {
  VALID_CATEGORY_KEYS,
  normalizeNotes,
  normalizeCategory,
  deriveStatus,
  isUsable,
} from '../utils/receiptHelpers';

// ─── normalizeNotes ────────────────────────────────────────────────────────────

describe('normalizeNotes', () => {
  it('returns an array unchanged', () => {
    expect(normalizeNotes(['note one', 'note two'])).toEqual(['note one', 'note two']);
  });

  it('wraps a plain string in an array', () => {
    expect(normalizeNotes('single note')).toEqual(['single note']);
  });

  it('returns empty array for null', () => {
    expect(normalizeNotes(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(normalizeNotes(undefined)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    // empty string is falsy → []
    expect(normalizeNotes('')).toEqual([]);
  });

  it('coerces a number to string wrapped in array', () => {
    expect(normalizeNotes(42)).toEqual(['42']);
  });
});

// ─── normalizeCategory ────────────────────────────────────────────────────────

describe('normalizeCategory', () => {
  it('passes through a valid category key untouched', () => {
    for (const key of VALID_CATEGORY_KEYS) {
      const result = normalizeCategory(key, []);
      expect(result.category).toBe(key);
      expect(result.notes).toEqual([]);
    }
  });

  it('defaults an unknown category to Other and appends a note', () => {
    const { category, notes } = normalizeCategory('Groceries', []);
    expect(category).toBe('Other');
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain('Groceries');
  });

  it('defaults null category to Other without adding a note', () => {
    const { category, notes } = normalizeCategory(null, []);
    expect(category).toBe('Other');
    expect(notes).toEqual([]);
  });

  it('preserves existing notes when defaulting', () => {
    const { notes } = normalizeCategory('Unknown', ['prior note']);
    expect(notes[0]).toBe('prior note');
    expect(notes).toHaveLength(2);
  });

  it('recognises all 7 valid category keys', () => {
    expect(VALID_CATEGORY_KEYS).toHaveLength(7);
    expect(VALID_CATEGORY_KEYS).toContain('Food');
    expect(VALID_CATEGORY_KEYS).toContain('Transport');
    expect(VALID_CATEGORY_KEYS).toContain('Other');
  });
});

// ─── deriveStatus ─────────────────────────────────────────────────────────────

describe('deriveStatus', () => {
  it('returns ready when vendor, date and positive total are all present', () => {
    expect(deriveStatus({ vendor: 'Starbucks', date: '2026-01-01', total: 5.50 })).toBe('ready');
  });

  it('returns needs_review when vendor is missing', () => {
    expect(deriveStatus({ vendor: null, date: '2026-01-01', total: 10 })).toBe('needs_review');
  });

  it('returns needs_review when date is missing', () => {
    expect(deriveStatus({ vendor: 'Shop', date: '', total: 10 })).toBe('needs_review');
  });

  it('returns needs_review when total is zero', () => {
    expect(deriveStatus({ vendor: 'Shop', date: '2026-01-01', total: 0 })).toBe('needs_review');
  });

  it('returns needs_review when total is a string zero', () => {
    expect(deriveStatus({ vendor: 'Shop', date: '2026-01-01', total: '0.00' })).toBe('needs_review');
  });

  it('returns ready when total is a positive numeric string', () => {
    expect(deriveStatus({ vendor: 'Shop', date: '2026-01-01', total: '12.99' })).toBe('ready');
  });
});

// ─── isUsable ─────────────────────────────────────────────────────────────────

describe('isUsable', () => {
  it('returns true for a non-empty string', () => {
    expect(isUsable('hello')).toBe(true);
  });

  it('returns true for a non-zero number', () => {
    expect(isUsable(0)).toBe(true); // 0 is not null/undefined/"" — it is usable
  });

  it('returns false for null', () => {
    expect(isUsable(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isUsable(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isUsable('')).toBe(false);
  });
});
