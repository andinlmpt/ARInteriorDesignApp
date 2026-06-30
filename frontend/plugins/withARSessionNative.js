const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withAppBuildGradle,
  withMainApplication,
  withDangerousMod,
  withXcodeProject,
  AndroidConfig,
  createRunOncePlugin,
} = require('@expo/config-plugins');

const ARCORE_VERSION = '1.46.0';
const ANDROID_PACKAGE = 'com.arinteriordesign.arsession';

function copyAndroidNativeSources(projectRoot, platformProjectRoot) {
  const srcDir = path.join(projectRoot, 'native', 'android');
  const destDir = path.join(
    platformProjectRoot,
    'app',
    'src',
    'main',
    'java',
    ...ANDROID_PACKAGE.split('.')
  );

  fs.mkdirSync(destDir, { recursive: true });

  for (const file of fs.readdirSync(srcDir)) {
    if (!file.endsWith('.java')) {
      continue;
    }
    fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
  }
}

function copyIosNativeSources(projectRoot, platformProjectRoot, projectName) {
  const srcDir = path.join(projectRoot, 'native', 'ios');
  const destDir = path.join(platformProjectRoot, projectName);
  fs.mkdirSync(destDir, { recursive: true });

  for (const file of ['ARSessionNative.swift', 'ARSessionNative.m']) {
    fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
  }
}

const withARSessionAndroidSources = (config) =>
  withDangerousMod(config, [
    'android',
    async (config) => {
      copyAndroidNativeSources(
        config.modRequest.projectRoot,
        config.modRequest.platformProjectRoot
      );
      return config;
    },
  ]);

const withARSessionIosSources = (config) =>
  withDangerousMod(config, [
    'ios',
    async (config) => {
      copyIosNativeSources(
        config.modRequest.projectRoot,
        config.modRequest.platformProjectRoot,
        config.modRequest.projectName
      );
      return config;
    },
  ]);

const withARSessionAndroidGradle = (config) =>
  withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes('com.google.ar:core')) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    implementation 'com.google.ar:core:${ARCORE_VERSION}'`
      );
    }
    return config;
  });

const withARSessionAndroidManifest = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      mainApplication,
      'com.google.ar.core',
      'optional'
    );

    const existingFeatures = manifest.manifest['uses-feature'] ?? [];
    const features = Array.isArray(existingFeatures) ? existingFeatures : [existingFeatures];
    const hasArFeature = features.some(
      (feature) => feature?.$?.['android:name'] === 'android.hardware.camera.ar'
    );

    if (!hasArFeature) {
      features.push({
        $: {
          'android:name': 'android.hardware.camera.ar',
          'android:required': 'false',
        },
      });
      manifest.manifest['uses-feature'] = features;
    }

    return config;
  });

const withARSessionMainApplication = (config) =>
  withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes('ARSessionNativePackage')) {
      if (contents.includes('import com.facebook.react.ReactApplication')) {
        contents = contents.replace(
          'import com.facebook.react.ReactApplication',
          `import ${ANDROID_PACKAGE}.ARSessionNativePackage\nimport com.facebook.react.ReactApplication`
        );
      } else if (contents.includes('import com.facebook.react.PackageList')) {
        contents = contents.replace(
          'import com.facebook.react.PackageList',
          `import ${ANDROID_PACKAGE}.ARSessionNativePackage\nimport com.facebook.react.PackageList`
        );
      }

      if (contents.includes('packages.apply {')) {
        contents = contents.replace(
          'packages.apply {',
          'packages.apply {\n            add(ARSessionNativePackage())'
        );
      } else if (contents.includes('return packages')) {
        contents = contents.replace(
          /return packages/,
          'packages.add(ARSessionNativePackage())\n          return packages'
        );
      } else if (contents.includes('List<ReactPackage> packages = new PackageList')) {
        contents = contents.replace(
          /List<ReactPackage> packages = new PackageList\(this\)\.getPackages\(\);/,
          `List<ReactPackage> packages = new PackageList(this).getPackages();\n            packages.add(new ARSessionNativePackage());`
        );
      }
    }

    config.modResults.contents = contents;
    return config;
  });

const withARSessionXcodeProject = (config) =>
  withXcodeProject(config, (config) => {
    const project = config.modResults;
    const projectName = config.modRequest.projectName;
    const groupKey = project.findPBXGroupKey({ name: projectName });

    const swiftPath = `${projectName}/ARSessionNative.swift`;
    const bridgePath = `${projectName}/ARSessionNative.m`;

    if (!project.hasFile(swiftPath)) {
      project.addSourceFile(swiftPath, null, groupKey);
    }
    if (!project.hasFile(bridgePath)) {
      project.addSourceFile(bridgePath, null, groupKey);
    }

    return config;
  });

const withARSessionNative = (config) => {
  config = withARSessionAndroidSources(config);
  config = withARSessionAndroidGradle(config);
  config = withARSessionAndroidManifest(config);
  config = withARSessionMainApplication(config);
  config = withARSessionIosSources(config);
  config = withARSessionXcodeProject(config);
  return config;
};

module.exports = createRunOncePlugin(withARSessionNative, 'withARSessionNative');
