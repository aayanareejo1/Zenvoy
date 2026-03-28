/**
 * Fixes "non-modular header inside framework module" Xcode errors that occur
 * when use_frameworks! :linkage => :static is enabled alongside react-native-firebase.
 *
 * Root cause: RNFBApp includes React-Core Obj-C headers via angle-bracket imports
 * (e.g. <React/RCTConvert.h>). With use_frameworks!, CocoaPods treats every pod as
 * a framework module, and Clang's -Werror flag turns the non-modular include into a
 * fatal error.
 *
 * Fix: set CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES on all pod
 * targets in the Podfile post_install hook. The correct Xcode build setting key has
 * the CLANG_ prefix — omitting it has no effect.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = 'CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES';

const INJECTION = `
  # --- withFirebaseModularHeaders ---
  # Allow non-modular React-Core header includes required by react-native-firebase
  # when use_frameworks! :linkage => :static is active (CLANG_ prefix is required).
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |bc|
      bc.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    end
  end
  # --- end withFirebaseModularHeaders ---`;

const withFirebaseModularHeaders = (config) =>
  withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile',
      );
      let contents = fs.readFileSync(podfilePath, 'utf-8');

      // Idempotent — skip if already injected
      if (contents.includes(MARKER)) {
        return config;
      }

      // Inject immediately after the opening of the post_install block.
      // The Expo-generated Podfile always has exactly one post_install block.
      const HOOK = 'post_install do |installer|';
      if (!contents.includes(HOOK)) {
        throw new Error(
          '[withFirebaseModularHeaders] Could not find post_install hook in Podfile. ' +
          'The Expo-generated Podfile structure may have changed.',
        );
      }

      contents = contents.replace(HOOK, HOOK + INJECTION);
      fs.writeFileSync(podfilePath, contents);
      return config;
    },
  ]);

module.exports = withFirebaseModularHeaders;
