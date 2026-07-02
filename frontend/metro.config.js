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
  // react-native-webview: web stub vs native package
  if (moduleName === 'react-native-webview') {
    if (platform === 'web') {
      return {
        type: 'sourceFile',
        filePath: path.resolve(__dirname, 'react-native-webview.web.js'),
      };
    }
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'node_modules/react-native-webview/index.js'),
    };
  }

  // Intercept internal react-native-webview imports on web only
  if (platform === 'web') {
    const originPath = context.originModulePath || '';
    if (originPath.includes('react-native-webview')) {
      return {
        type: 'empty',
      };
    }
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

// Add .mjs to support modern ES modules if not already present
if (!config.resolver.sourceExts.includes('mjs')) {
  config.resolver.sourceExts.push('mjs');
}

// Add support for 3D model files
if (!config.resolver.assetExts.includes('glb')) {
  config.resolver.assetExts.push('glb', 'gltf', 'mtl', 'obj');
}

module.exports = config;

