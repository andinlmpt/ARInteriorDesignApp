// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.watchFolders = [__dirname];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
];

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
    // Check if the origin module is from react-native-webview
    const originPath = context.originModulePath || '';
    if (originPath.includes('react-native-webview')) {
      // This is an internal import from react-native-webview package
      // Return empty module to prevent bundling errors
      return {
        type: 'empty',
      };
    }
  }

  // Use default resolver for everything else
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

// Add .mjs to support modern ES modules if not already present
if (!config.resolver.sourceExts.includes('mjs')) {
  config.resolver.sourceExts.push('mjs');
}

module.exports = config;

