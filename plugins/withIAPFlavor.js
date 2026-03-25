const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Injects missingDimensionStrategy for react-native-iap, which ships separate
 * Amazon and Google Play variants. This must survive every `expo prebuild`.
 */
const withIAPFlavor = (config) =>
  withAppBuildGradle(config, (mod) => {
    const contents = mod.modResults.contents;

    if (contents.includes("missingDimensionStrategy 'store'")) {
      // Already injected — idempotent
      return mod;
    }

    // Insert inside the defaultConfig block, after the opening brace
    mod.modResults.contents = contents.replace(
      /defaultConfig\s*\{/,
      `defaultConfig {\n        missingDimensionStrategy 'store', 'play'`,
    );

    return mod;
  });

module.exports = withIAPFlavor;
