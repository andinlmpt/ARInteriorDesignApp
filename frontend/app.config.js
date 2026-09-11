import 'dotenv/config';

const existingConfig = {
  expo: {
    name: 'Maharlika Furniture',
    slug: 'ARInteriorDesinApp',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: 'arinteriordesinapp',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    icon: './assets/images/icon.png',
    splash: {
      image: './assets/images/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#FFFFFF',
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      package: 'com.arinteriordesign.app',
      adaptiveIcon: {
        foregroundImage: './assets/images/icon.png',
        backgroundColor: '#FFFFFF',
      },
    },
    web: {
      output: 'static',
      favicon: './assets/images/icon.png',
    },
    plugins: [
      'expo-router',
      'expo-dev-client',
      './plugins/withUnity.js',
      [
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 29,
            ndkVersion: '27.2.12479018',
          },
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission:
            'Allow $(PRODUCT_NAME) to access your camera for room scanning and AR features.',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: false,
    },
  },
};

const ensureExpoPublicVar = (publicKey, value) => {
  if (value && !process.env[publicKey]) {
    process.env[publicKey] = value;
  }
};

export default () => {
  // Load .env file if it exists (dotenv/config is already imported at top)
  // Environment variables are now available via process.env
  
  ensureExpoPublicVar('EXPO_PUBLIC_OPENAI_API_KEY', process.env.OPENAI_API_KEY);
  ensureExpoPublicVar('EXPO_PUBLIC_REPLICATE_API_TOKEN', process.env.REPLICATE_API_TOKEN);
  
  // API Base URL - prioritize explicit env var, fallback to default
  // For physical devices, set EXPO_PUBLIC_API_BASE_URL=http://YOUR_IP:3000/api/v1
  ensureExpoPublicVar('EXPO_PUBLIC_API_BASE_URL', process.env.EXPO_PUBLIC_API_BASE_URL || process.env.API_BASE_URL);
  ensureExpoPublicVar('EXPO_PUBLIC_LAYOUT_API_BASE_URL', process.env.EXPO_PUBLIC_LAYOUT_API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || process.env.API_BASE_URL);
  
  ensureExpoPublicVar('EXPO_PUBLIC_LAYOUT_API_KEY', process.env.LAYOUT_API_KEY);
  ensureExpoPublicVar('EXPO_PUBLIC_LAYOUT_BEARER_TOKEN', process.env.LAYOUT_BEARER_TOKEN);
  ensureExpoPublicVar('EXPO_PUBLIC_UNITY_BUILD_URL', process.env.UNITY_BUILD_URL);

  return {
    expo: {
      ...existingConfig.expo,
      extra: {
        router: {},
        eas: {
          projectId: '3193904b-282e-4dbe-94e5-4880f938778e',
        },
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN,
        API_BASE_URL: process.env.API_BASE_URL,
        unityBuildUrl: process.env.EXPO_PUBLIC_UNITY_BUILD_URL,
      },
    },
  };
};

