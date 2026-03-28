/**
 * Fixes "non-modular header inside framework module" Xcode errors that occur
 * when use_frameworks! :linkage => :static is enabled alongside react-native-firebase.
 *
 * Injects a snippet into the existing Expo-generated post_install hook so that
 * all pod targets allow non-modular includes (required for RNFBApp's Obj-C headers
 * to build correctly as static frameworks).
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withFirebaseModularHeaders = (config) =>
  withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile',
      );
      let contents = fs.readFileSync(podfilePath, 'utf-8');

      if (!contents.includes('ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
        contents = contents.replace(
          'post_install do |installer|',
          `post_install do |installer|
  # Allow non-modular headers required by react-native-firebase when
  # use_frameworks! :linkage => :static is active.
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    end
  end`,
        );
        fs.writeFileSync(podfilePath, contents);
      }

      return config;
    },
  ]);

module.exports = withFirebaseModularHeaders;
