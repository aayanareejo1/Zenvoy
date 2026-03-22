export const COLORS = {
  bg: '#0A0A0A',
  card: '#1A1A1A',
  cardAlt: '#222222',
  border: '#2A2A2A',
  accent: '#00E5A0',
  textPrimary: '#F0F0F0',
  textSecondary: '#808080',
  danger: '#FF5E5E',
  warning: '#FFA500',
};

export const RADIUS = { card: 14, button: 12, input: 10, chip: 20 };
export const BTN_HEIGHT = 52;
export const H_PAD = 16;

export const CATEGORIES = [
  { key: 'Food',          label: 'Food & Drink',  emoji: '🍔', color: '#FF6B6B' },
  { key: 'Transport',     label: 'Transport',      emoji: '🚗', color: '#4ECDC4' },
  { key: 'Shopping',      label: 'Shopping',       emoji: '🛍️', color: '#A78BFA' },
  { key: 'Business',      label: 'Business',       emoji: '💼', color: '#60A5FA' },
  { key: 'Healthcare',    label: 'Healthcare',     emoji: '🏥', color: '#34D399' },
  { key: 'Entertainment', label: 'Entertainment',  emoji: '🎬', color: '#FBBF24' },
  { key: 'Other',         label: 'Other',          emoji: '📋', color: '#9CA3AF' },
];

export const getCategoryInfo = (key) =>
  CATEGORIES.find(c => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1];
