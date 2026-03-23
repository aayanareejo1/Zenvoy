// ─── Design System ─────────────────────────────────────────────────────────────
// Fintech dark, premium teal accent, zero neon.

export const COLORS = {
  // Backgrounds
  bg:            '#0A0A0F',
  bgElevated:    '#111118',

  // Surfaces
  card:          '#16161E',
  cardAlt:       '#1E1E2A',
  cardPressed:   '#202030',

  // Borders
  border:        '#252536',
  borderStrong:  '#373752',

  // Accent — premium teal (not crypto-neon)
  accent:        '#00C4A0',
  accentGlow:    'rgba(0,196,160,0.22)',
  accentMuted:   'rgba(0,196,160,0.09)',
  accentStrong:  '#00D9B0',

  // Text
  textPrimary:   '#F2F2F7',
  textSecondary: '#6E6E82',
  textTertiary:  '#3D3D52',

  // Semantic
  danger:        '#FF453A',
  dangerMuted:   'rgba(255,69,58,0.12)',
  warning:       '#FF9F0A',
  warningMuted:  'rgba(255,159,10,0.12)',
  success:       '#30D158',
  successMuted:  'rgba(48,209,88,0.12)',

  // Overlays
  overlay:       'rgba(0,0,0,0.72)',
  scrim:         'rgba(0,0,0,0.45)',
};

// ─── Typography ────────────────────────────────────────────────────────────────
export const TYPE = {
  hero:    { fontSize: 38, fontWeight: '800', letterSpacing: -1,   color: COLORS.textPrimary },
  h1:      { fontSize: 24, fontWeight: '700', letterSpacing: -0.4, color: COLORS.textPrimary },
  h2:      { fontSize: 20, fontWeight: '700', letterSpacing: -0.2, color: COLORS.textPrimary },
  h3:      { fontSize: 17, fontWeight: '600',                       color: COLORS.textPrimary },
  body:    { fontSize: 16, fontWeight: '400', lineHeight: 24,       color: COLORS.textPrimary },
  callout: { fontSize: 15, fontWeight: '500',                       color: COLORS.textPrimary },
  sub:     { fontSize: 13, fontWeight: '500',                       color: COLORS.textSecondary },
  caption: { fontSize: 11, fontWeight: '600', letterSpacing: 0.6,
             textTransform: 'uppercase',                            color: COLORS.textSecondary },
};

// ─── Spacing ───────────────────────────────────────────────────────────────────
export const SPACE = {
  xxs: 2, xs: 4, sm: 8, md: 12,
  lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48,
};

// ─── Radius ────────────────────────────────────────────────────────────────────
export const RADIUS = {
  sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, pill: 100,
  // semantic aliases kept for backwards compat
  card: 16, button: 14, input: 12, chip: 100,
};

// ─── Button ────────────────────────────────────────────────────────────────────
export const BTN_HEIGHT = 54;
export const H_PAD      = 20;

// ─── Elevation helpers (Android-friendly) ─────────────────────────────────────
export const ELEVATION = {
  card:  { elevation: 3,  shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 6 },
  sheet: { elevation: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.4, shadowRadius: 20 },
  toast: { elevation: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
  modal: { elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 24 },
  glow:  { elevation: 10, shadowColor: '#00C4A0', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 20 },
};

// ─── Categories ────────────────────────────────────────────────────────────────
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

// ─── Themes (for ThemeContext) ──────────────────────────────────────────────────

export const DARK_THEME = {
  bg:            '#0A0A0F',
  bgElevated:    '#111118',
  card:          '#16161E',
  cardAlt:       '#1E1E2A',
  cardPressed:   '#202030',
  border:        '#252536',
  borderStrong:  '#373752',
  accent:        '#00C4A0',
  accentGlow:    'rgba(0,196,160,0.22)',
  accentMuted:   'rgba(0,196,160,0.09)',
  accentStrong:  '#00D9B0',
  textPrimary:   '#F2F2F7',
  textSecondary: '#6E6E82',
  textTertiary:  '#3D3D52',
  danger:        '#FF453A',
  dangerMuted:   'rgba(255,69,58,0.12)',
  warning:       '#FF9F0A',
  warningMuted:  'rgba(255,159,10,0.12)',
  success:       '#30D158',
  successMuted:  'rgba(48,209,88,0.12)',
  overlay:       'rgba(0,0,0,0.72)',
  scrim:         'rgba(0,0,0,0.45)',
};

export const LIGHT_THEME = {
  bg:            '#F2F2F7',
  bgElevated:    '#FFFFFF',
  card:          '#FFFFFF',
  cardAlt:       '#F0F0F5',
  cardPressed:   '#E5E5EA',
  border:        '#E0E0E8',
  borderStrong:  '#C7C7D0',
  accent:        '#00A882',
  accentGlow:    'rgba(0,168,130,0.18)',
  accentMuted:   'rgba(0,168,130,0.09)',
  accentStrong:  '#00C49A',
  textPrimary:   '#1C1C1E',
  textSecondary: '#6C6C80',
  textTertiary:  '#AEAEB2',
  danger:        '#FF3B30',
  dangerMuted:   'rgba(255,59,48,0.10)',
  warning:       '#FF9500',
  warningMuted:  'rgba(255,149,0,0.10)',
  success:       '#34C759',
  successMuted:  'rgba(52,199,89,0.10)',
  overlay:       'rgba(0,0,0,0.50)',
  scrim:         'rgba(0,0,0,0.28)',
};

export const getTheme = (isDarkMode) => isDarkMode ? DARK_THEME : LIGHT_THEME;
