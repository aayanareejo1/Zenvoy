import { PixelRatio } from 'react-native';

/** Generic label for any element. */
export const getA11yLabel = (text) => ({
  accessibilityLabel: text,
});

/** Accessible button props. */
export const getButtonA11y = (label) => ({
  accessible:          true,
  accessibilityLabel:  label,
  accessibilityRole:   'button',
});

/** Accessible heading props. */
export const getHeadingA11y = (text) => ({
  accessible:         true,
  accessibilityLabel: text,
  accessibilityRole:  'header',
});

/**
 * Scale a font size to respect the system font size preference.
 * React Native's Text component does this automatically, but use this
 * when you need to compute derived sizes (e.g., icon sizing).
 */
export const getScaledFontSize = (baseSize) =>
  Math.round(baseSize * PixelRatio.getFontScale());
