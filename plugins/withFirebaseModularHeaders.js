/**
 * Podfile patches for react-native-firebase v21 + Expo SDK 55 + Xcode 16.
 *
 * Patch A — inhibit_all_warnings! (xcconfig level, no post_install needed)
 *   Inserted after the `platform :ios` line. CocoaPods writes
 *   GCC_WARN_INHIBIT_ALL_WARNINGS = YES into every pod's xcconfig during
 *   `pod install`. This suppresses the [-Wimplicit-int] errors from BoringSSL-GRPC
 *   and nanopb that Xcode 16 promotes to fatal errors.
 *
 * Patch B — CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES (post_install)
 *   Injected into the EXISTING post_install block (CocoaPods only runs the last
 *   post_install block — appending a new one would replace react_native_post_install).
 *   Allows RNFBApp to include React-Core Obj-C headers inside a framework module
 *   when use_frameworks! :linkage => :static is active.
 *   The CLANG_ prefix is mandatory — the bare key ALLOW_NON_MODULAR_INCLUDES
 *   without it is silently ignored by Xcode.
 *
 * Patch C — BoringSSL-GRPC per-file flag fix (post_install)
 *   Strips -GCC_WARN_INHIBIT_ALL_WARNINGS from BoringSSL-GRPC source file
 *   COMPILER_FLAGS and replaces it with -w. Xcode 16 Clang misparses the -G
 *   prefix as a MIPS/AArch64 GP linker flag, discards the whole entry, and
 *   exposes all of BoringSSL's legacy C implicit-int patterns as fatal errors.
 *   (Fixed upstream in gRPC ≥ 1.65.2; belt-and-suspenders for older lock files.)
 *
 * References: grpc/grpc#36888, firebase/firebase-ios-sdk#13115,
 *             invertase/react-native-firebase#8020
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PATCH_A_MARKER = '# zenvoy:inhibit_all_warnings';
const PATCH_B_MARKER = '# zenvoy:firebase_post_install_patches';
const POST_INSTALL_HOOK = 'post_install do |installer|';

const PATCH_B_C = `  ${PATCH_B_MARKER}

  # Patch B: Allow non-modular React-Core headers in all framework pod targets.
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |bc|
      bc.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    end
  end

  # Patch C: Replace broken -GCC_WARN_INHIBIT_ALL_WARNINGS per-file flag in
  # BoringSSL-GRPC with plain -w. Xcode 16 misparses -G prefix as a linker flag.
  installer.pods_project.targets.each do |target|
    next unless target.name == 'BoringSSL-GRPC'
    target.source_build_phase.files.each do |file|
      next unless file.settings && file.settings['COMPILER_FLAGS']
      flags = file.settings['COMPILER_FLAGS'].split
      flags.reject! { |f| f == '-GCC_WARN_INHIBIT_ALL_WARNINGS' }
      flags << '-w'
      file.settings['COMPILER_FLAGS'] = flags.join(' ')
    end
  end

`;

const withFirebaseModularHeaders = (config) =>
  withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile',
      );
      let contents = fs.readFileSync(podfilePath, 'utf-8');

      // Patch A: inhibit_all_warnings! after platform :ios declaration
      if (!contents.includes(PATCH_A_MARKER)) {
        const platformMatch = contents.match(/platform\s+:ios[^\n]*\n/);
        if (platformMatch) {
          const insertAt =
            contents.indexOf(platformMatch[0]) + platformMatch[0].length;
          contents =
            contents.slice(0, insertAt) +
            PATCH_A_MARKER + '\ninhibit_all_warnings!\n\n' +
            contents.slice(insertAt);
        }
      }

      // Patches B+C: inject into EXISTING post_install block
      // (do NOT append a new block — CocoaPods only runs the last one)
      if (!contents.includes(PATCH_B_MARKER)) {
        if (!contents.includes(POST_INSTALL_HOOK)) {
          throw new Error(
            '[withFirebaseModularHeaders] Could not find "' +
              POST_INSTALL_HOOK +
              '" in Podfile. Expo-generated Podfile structure may have changed.',
          );
        }
        contents = contents.replace(
          POST_INSTALL_HOOK,
          POST_INSTALL_HOOK + '\n' + PATCH_B_C,
        );
      }

      fs.writeFileSync(podfilePath, contents);
      return config;
    },
  ]);

module.exports = withFirebaseModularHeaders;
