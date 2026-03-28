/**
 * Podfile post_install patches required for react-native-firebase v21 on Expo SDK 55
 * with use_frameworks! :linkage => :static and Xcode 16.
 *
 * Patch 1 — CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES
 *   RNFBApp imports React-Core Obj-C headers via angle-bracket syntax inside a
 *   framework module. Xcode 16 turns this into a fatal error with -Werror.
 *   Setting CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES on all
 *   targets suppresses it. (Note: the CLANG_ prefix is required — omitting it
 *   silently has no effect.)
 *
 * Patch 2 — Remove bad per-file flag from BoringSSL-GRPC
 *   BoringSSL-GRPC's podspec injects `-GCC_WARN_INHIBIT_ALL_WARNINGS` as a
 *   per-file COMPILER_FLAGS entry. Xcode 16's Clang misparses the `-G` prefix
 *   as a MIPS/AArch64 GP-relative linker option and discards the whole flag,
 *   exposing all of BoringSSL's legacy C implicit-int and OSSpinLock patterns
 *   as errors. Fix: strip the flag from every BoringSSL-GRPC source file entry.
 *   (Fixed upstream in gRPC 1.65.2 / firebase-ios-sdk 11.2.0, but pod lock may
 *   pin an older version.)
 *
 * Patch 3 — GCC_WARN_INHIBIT_ALL_WARNINGS at target level
 *   Belt-and-suspenders suppression for all remaining third-party pod warning
 *   noise (nanopb K&R C patterns, gRPC-Core OSSpinLock deprecations, etc.).
 *   This is a target-level Xcode build setting — it does NOT trigger the -G
 *   parse error that the per-file COMPILER_FLAGS entry causes.
 *
 * References:
 *   grpc/grpc#36888, firebase/firebase-ios-sdk#13115,
 *   invertase/react-native-firebase#8020, mikehardy/rnfbdemo make-demo.sh
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = 'withFirebasePodfilePatches';

const INJECTION = `
  # ---- ${MARKER} ----

  # Patch 1: Allow non-modular React-Core header includes in all framework targets.
  # Required for RNFBApp when use_frameworks! :linkage => :static is active.
  # CLANG_ prefix is mandatory — bare ALLOW_NON_MODULAR_INCLUDES has no effect.
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |bc|
      bc.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    end
  end

  # Patch 2: Remove the per-file -GCC_WARN_INHIBIT_ALL_WARNINGS flag from
  # BoringSSL-GRPC source files. Xcode 16 Clang misparses -G as a linker flag,
  # discards the whole entry, and exposes all BoringSSL implicit-int errors.
  installer.pods_project.targets.each do |target|
    if target.name == 'BoringSSL-GRPC'
      target.source_build_phase.files.each do |file|
        if file.settings && file.settings['COMPILER_FLAGS']
          flags = file.settings['COMPILER_FLAGS'].split
          flags.reject! { |flag| flag == '-GCC_WARN_INHIBIT_ALL_WARNINGS' }
          file.settings['COMPILER_FLAGS'] = flags.join(' ')
        end
      end
    end
  end

  # Patch 3: Suppress all warnings at the target level for every pod.
  # Catches remaining nanopb / gRPC-Core / abseil warnings that become errors
  # with Xcode 16's stricter -Werror defaults.
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |bc|
      bc.build_settings['GCC_WARN_INHIBIT_ALL_WARNINGS'] = 'YES'
    end
  end

  # ---- end ${MARKER} ----`;

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

      const HOOK = 'post_install do |installer|';
      if (!contents.includes(HOOK)) {
        throw new Error(
          '[withFirebaseModularHeaders] post_install hook not found in Podfile. ' +
          'The Expo-generated Podfile structure may have changed.',
        );
      }

      contents = contents.replace(HOOK, HOOK + INJECTION);
      fs.writeFileSync(podfilePath, contents);
      return config;
    },
  ]);

module.exports = withFirebaseModularHeaders;
