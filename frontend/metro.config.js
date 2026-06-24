// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Custom resolver to handle react-native-webview on web
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Intercept react-native-webview and all its internal modules on web
  if (platform === 'web') {
    // Handle the main package
    if (moduleName === 'react-native-webview') {
      return {
        type: 'sourceFile',
        filePath: path.resolve(__dirname, 'react-native-webview.web.js'),
      };
    }

    // Handle internal imports from react-native-webview package
    const originPath = context.originModulePath || '';
    if (originPath.includes('react-native-webview')) {
      return { type: 'empty' };
    }
  }

  // Use default resolver for everything else
  if (originalResolveRequest) {
    const result = originalResolveRequest(context, moduleName, platform);

    // Fix for Three.js examples resolution (missing .js extension in expo-three and other libraries)
    if (moduleName.startsWith('three/examples/jsm/') && !moduleName.endsWith('.js')) {
      return originalResolveRequest(context, moduleName + '.js', platform);
    }

    return result;
  }

  // Fallback to default
  const result = context.resolveRequest(context, moduleName, platform);

  if (moduleName.startsWith('three/examples/jsm/') && !moduleName.endsWith('.js')) {
    return context.resolveRequest(context, moduleName + '.js', platform);
  }

  return result;
};

// Add .mjs to support modern ES modules if not already present
if (!config.resolver.sourceExts.includes('mjs')) {
  config.resolver.sourceExts.push('mjs');
}

module.exports = config;
