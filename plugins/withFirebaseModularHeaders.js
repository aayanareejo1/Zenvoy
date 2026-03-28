/**
 * Two-layer Podfile patch for react-native-firebase v21 + Expo SDK 55 + Xcode 16.
 *
 * Layer 1 — inhibit_all_warnings! (Podfile DSL, xcconfig level)
 *   Appended right after `platform :ios` so it applies at CocoaPods resolve
 *   time, writing GCC_WARN_INHIBIT_ALL_WARNINGS = YES into every pod's xcconfig.
 *   This is independent of post_install hooks and is the most reliable suppression.
 *
 * Layer 2 — Appended post_install block (xcodeproj level)
 *   CocoaPods accumulates ALL post_install callbacks from the Podfile and runs
 *   them all (they are stored as a list, not overwritten). Appending a new block
 *   is therefore safe and avoids fragile injection into the existing block.
 *   This applies:
 *     a) CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES
 *        (required for RNFBApp Obj-C headers under use_frameworks! :linkage => :static)
 *     b) Removal of -GCC_WARN_INHIBIT_ALL_WARNINGS per-file flag from BoringSSL-GRPC
 *        (Xcode 16 Clang misparses -G prefix, breaking warning suppression in BoringSSL)
 *     c) GCC_WARN_INHIBIT_ALL_WARNINGS = YES at target-build-configuration level
 *        (belt-and-suspenders for nanopb / gRPC-Core residual warnings)
 *
 * References: grpc/grpc#36888, firebase/firebase-ios-sdk#13115,
 *             invertase/react-native-firebase#8020, mikehardy/rnfbdemo
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const LAYER1_MARKER = '# zenvoy:inhibit_all_warnings';
const LAYER2_MARKER = '# zenvoy:firebase_post_install';

// Injected immediately after 'platform :ios, ...' line
const LAYER1 = `${LAYER1_MARKER}
inhibit_all_warnings!
`;

// Appended to end of Podfile — CocoaPods runs ALL post_install blocks
const LAYER2 = `
${LAYER2_MARKER}
post_install do |installer|
  installer.pods_project.targets.each do |target|
    # (a) Allow non-modular React-Core headers in all framework targets.
    # CLANG_ prefix is required — ALLOW_NON_MODULAR_INCLUDES without it is a no-op.
    target.build_configurations.each do |bc|
      bc.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    end

    # (b) Strip the broken -GCC_WARN_INHIBIT_ALL_WARNINGS per-file flag from BoringSSL-GRPC.
    # Xcode 16 Clang interprets -G as a MIPS/AArch64 GP linker flag, discards the entry,
    # and exposes all BoringSSL implicit-int warnings as errors.
    if target.name == 'BoringSSL-GRPC'
      target.source_build_phase.files.each do |file|
        if file.settings && file.settings['COMPILER_FLAGS']
          flags = file.settings['COMPILER_FLAGS'].split
          flags.reject! { |f| f == '-GCC_WARN_INHIBIT_ALL_WARNINGS' }
          flags << '-w'
          file.settings['COMPILER_FLAGS'] = flags.join(' ')
        end
      end
    end

    # (c) Belt-and-suspenders: set warning inhibit at target-config level.
    target.build_configurations.each do |bc|
      bc.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'YES'
    end
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

      // --- Layer 1: inhibit_all_warnings! after platform declaration ---
      if (!contents.includes(LAYER1_MARKER)) {
        // Match 'platform :ios, ...' line and insert after it
        const platformMatch = contents.match(/platform\s+:ios[^\n]*\n/);
        if (platformMatch) {
          const insertAt = contents.indexOf(platformMatch[0]) + platformMatch[0].length;
          contents = contents.slice(0, insertAt) + LAYER1 + contents.slice(insertAt);
        }
        // If platform line not found, fall through — Layer 2 will still apply
      }

      // --- Layer 2: appended post_install block ---
      if (!contents.includes(LAYER2_MARKER)) {
        contents = contents + LAYER2;
      }

      fs.writeFileSync(podfilePath, contents);
      return config;
    },
  ]);

module.exports = withFirebaseModularHeaders;
