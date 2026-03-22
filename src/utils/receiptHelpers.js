// Central source of truth for receipt field logic.
// Import from here rather than duplicating across screens/services.

export const VALID_CATEGORY_KEYS = [
  'Food', 'Transport', 'Shopping', 'Business', 'Healthcare', 'Entertainment', 'Other',
];

/** Ensure notes is always a plain array of strings. */
export const normalizeNotes = (notes) => {
  if (Array.isArray(notes)) return notes;
  if (notes) return [String(notes)];
  return [];
};

/**
 * Validate and coerce a category key.
 * Returns { category, notes } — notes may have an extra entry if the key was invalid.
 */
export const normalizeCategory = (cat, existingNotes = []) => {
  if (VALID_CATEGORY_KEYS.includes(cat)) return { category: cat, notes: existingNotes };
  const note = cat ? `Category "${cat}" not recognised — defaulted to Other` : null;
  return {
    category: 'Other',
    notes: note ? [...existingNotes, note] : existingNotes,
  };
};

/**
 * Route a receipt to needs_review if any required field is absent/zero,
 * otherwise ready.
 */
export const deriveStatus = (receipt) => {
  const hasVendor = !!receipt.vendor;
  const hasDate   = !!receipt.date;
  const hasTotal  = parseFloat(receipt.total) > 0;
  return hasVendor && hasDate && hasTotal ? 'ready' : 'needs_review';
};

/** True when a field value is present and meaningful. */
export const isUsable = (v) => v != null && v !== '';
