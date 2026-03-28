import {
  deriveStatus,
  normalizeNotes,
  normalizeCategory,
} from '../src/utils/receiptHelpers';

// ─── deriveStatus ─────────────────────────────────────────────────────────────

describe('deriveStatus', () => {
  it('returns "ready" when vendor, date, and total are all present', () => {
    const receipt = { vendor: 'Tim Hortons', date: '2026-01-15', total: '12.50' };
    expect(deriveStatus(receipt)).toBe('ready');
  });

  it('returns "needs_review" when vendor is missing', () => {
    const receipt = { vendor: '', date: '2026-01-15', total: '12.50' };
    expect(deriveStatus(receipt)).toBe('needs_review');
  });

  it('returns "needs_review" when total is zero', () => {
    const receipt = { vendor: 'Tim Hortons', date: '2026-01-15', total: '0' };
    expect(deriveStatus(receipt)).toBe('needs_review');
  });
});

// ─── normalizeNotes ───────────────────────────────────────────────────────────

describe('normalizeNotes', () => {
  it('returns the array as-is when given an array', () => {
    const notes = ['note one', 'note two'];
    expect(normalizeNotes(notes)).toEqual(['note one', 'note two']);
  });

  it('wraps a string in an array', () => {
    expect(normalizeNotes('single note')).toEqual(['single note']);
  });

  it('returns an empty array for null', () => {
    expect(normalizeNotes(null)).toEqual([]);
  });
});

// ─── normalizeCategory ────────────────────────────────────────────────────────

describe('normalizeCategory', () => {
  it('returns the category unchanged when it is a valid key', () => {
    const result = normalizeCategory('Food', []);
    expect(result).toEqual({ category: 'Food', notes: [] });
  });

  it('defaults to "Other" and appends a note for an invalid key', () => {
    const result = normalizeCategory('Groceries', []);
    expect(result.category).toBe('Other');
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]).toMatch(/Groceries/);
  });

  it('defaults to "Other" with no extra note when category is null', () => {
    const result = normalizeCategory(null, []);
    expect(result.category).toBe('Other');
    expect(result.notes).toEqual([]);
  });
});
