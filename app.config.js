// app.config.js — dynamic config so EAS file secrets can be used for
// googleServicesFile paths (env vars not supported in static app.json).
// Locally falls back to the file at the project root.

module.exports = {
  expo: {
    name: 'Zenvoy',
    slug: 'zenvoy',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './icon.png',
    platforms: ['android', 'ios'],
    ios: {
      bundleIdentifier: 'com.aareejo.zenvoy',
      supportsTablet: false,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_INFO_PLIST ?? './GoogleService-Info.plist',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: 'com.aareejo.zenvoy',
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
      permissions: ['android.permission.RECORD_AUDIO'],
    },
    plugins: [
      '@react-native-firebase/app',
      '@react-native-google-signin/google-signin',
      './plugins/withIAPFlavor',
      [
        'expo-image-picker',
        {
          photosPermission: 'Allow Zenvoy to access your photos to scan receipts.',
          cameraPermission: 'Allow Zenvoy to use your camera to scan receipts.',
        },
      ],
      'expo-image',
      [
        'expo-build-properties',
        {
          ios: {
            deploymentTarget: '16.0',
            useFrameworks: 'static',
          },
        },
      ],
    ],
    extra: {
      eas: {
        projectId: 'bf9bd263-9d4d-465b-8c05-a5f0778a68e1',
      },
    },
  },
};
