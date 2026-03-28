// ─── Design System — Midnight Blue Theme ─────────────────────────────────────
//
// Philosophy:
//   Deep midnight blue base → rich navy surfaces → indigo-tinted borders.
//   Royal blue (#3B82F6) as the single accent — buttons, prices, highlights.
//   No teal or cyan anywhere.
//
// Palette reference:
//   Royal Blue     #3B82F6  — primary accent (CTAs, prices, key metrics)
//   Sky Blue       #60A5FA  — secondary/strong accent (icons, badges)
//   Midnight       #090C15  — deepest background
//   Deep Navy      #0F1322  — elevated shell (headers, tab bar)
//   Navy Card      #161B2E  — primary card surface
//   Lifted Navy    #1C2238  — second-level card

export const COLORS = {
  // ── Backgrounds ─────────────────────────────────────────────────────────────
  bg:          '#050A15',   // near-black navy
  bgElevated:  '#0A1220',   // deep navy — headers, tab bar, modals

  // ── Surfaces ─────────────────────────────────────────────────────────────────
  card:        '#0D1627',   // navy card — primary surfaces
  cardAlt:     '#131F37',   // lifted navy — second-level cards
  cardPressed: '#1A2A47',   // pressed state

  // ── Borders ───────────────────────────────────────────────────────────────────
  border:      '#1E2D4A',   // dark indigo — subtle dividers
  borderStrong:'#2A3D60',   // stronger indigo rule

  // ── Accent — premium blue ─────────────────────────────────────────────────────
  accent:      '#0084FF',
  accentGlow:  'rgba(0,132,255,0.25)',
  accentMuted: 'rgba(0,132,255,0.10)',
  accentStrong:'#339CFF',   // lighter blue — icons, secondary elements
  accentSubtle:'rgba(0,132,255,0.12)',

  // ── Text ─────────────────────────────────────────────────────────────────────
  textPrimary:   '#FFFFFF',
  textSecondary: '#E2E8F4',   // near-white
  textTertiary:  '#B0BEDA',   // light blue-white

  // ── Semantic ─────────────────────────────────────────────────────────────────
  danger:      '#FF453A',
  dangerMuted: 'rgba(255,69,58,0.12)',
  warning:     '#FF9F0A',
  warningMuted:'rgba(255,159,10,0.12)',
  success:     '#30D158',
  successMuted:'rgba(48,209,88,0.12)',

  // ── Overlays ─────────────────────────────────────────────────────────────────
  overlay: 'rgba(0,0,0,0.75)',
  scrim:   'rgba(0,0,0,0.48)',
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
  card: 16, button: 14, input: 12, chip: 100,
};

// ─── Button ────────────────────────────────────────────────────────────────────
export const BTN_HEIGHT = 54;
export const H_PAD      = 20;

// ─── Elevation helpers ────────────────────────────────────────────────────────
export const ELEVATION = {
  card:  { elevation: 3,  shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.30, shadowRadius: 6  },
  sheet: { elevation: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.45, shadowRadius: 20 },
  toast: { elevation: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4  }, shadowOpacity: 0.30, shadowRadius: 12 },
  modal: { elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8  }, shadowOpacity: 0.50, shadowRadius: 24 },
  // Blue glow — primary CTA scan button
  glow:  { elevation: 10, shadowColor: '#0084FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 18 },
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

// ─── Themes ───────────────────────────────────────────────────────────────────

export const DARK_THEME = {
  bg:           '#050A15',
  bgElevated:   '#0A1220',
  card:         '#0D1627',
  cardAlt:      '#131F37',
  cardPressed:  '#1A2A47',
  border:       '#1E2D4A',
  borderStrong: '#2A3D60',
  accent:       '#0084FF',
  accentGlow:   'rgba(0,132,255,0.25)',
  accentMuted:  'rgba(0,132,255,0.10)',
  accentStrong: '#339CFF',
  accentSubtle: 'rgba(0,132,255,0.12)',
  textPrimary:   '#FFFFFF',
  textSecondary: '#E2E8F4',
  textTertiary:  '#B0BEDA',
  danger:      '#FF453A',
  dangerMuted: 'rgba(255,69,58,0.12)',
  warning:     '#FF9F0A',
  warningMuted:'rgba(255,159,10,0.12)',
  success:     '#30D158',
  successMuted:'rgba(48,209,88,0.12)',
  overlay: 'rgba(0,0,0,0.75)',
  scrim:   'rgba(0,0,0,0.48)',
};

export const LIGHT_THEME = {
  bg:           '#F9FAFB',
  bgElevated:   '#FFFFFF',
  card:         '#FFFFFF',
  cardAlt:      '#F3F4F6',
  cardPressed:  '#E5E7EB',
  border:       '#E5E7EB',
  borderStrong: '#D1D5DB',
  accent:       '#2563EB',   // darker royal blue for white bg contrast
  accentGlow:   'rgba(37,99,235,0.18)',
  accentMuted:  'rgba(37,99,235,0.08)',
  accentStrong: '#3B82F6',
  accentSubtle: 'rgba(37,99,235,0.10)',
  textPrimary:   '#111827',
  textSecondary: '#6B7280',
  textTertiary:  '#9CA3AF',
  danger:      '#EF4444',
  dangerMuted: 'rgba(239,68,68,0.10)',
  warning:     '#F59E0B',
  warningMuted:'rgba(245,158,11,0.10)',
  success:     '#10B981',
  successMuted:'rgba(16,185,129,0.10)',
  overlay: 'rgba(0,0,0,0.50)',
  scrim:   'rgba(0,0,0,0.28)',
};

export const getTheme = (isDarkMode) => isDarkMode ? DARK_THEME : LIGHT_THEME;
