const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  withSettingsGradle,
  withProjectBuildGradle,
  withGradleProperties,
  withStringsXml,
  withDangerousMod,
  createRunOncePlugin,
} = require('@expo/config-plugins');

const GAME_VIEW_STRING = 'Game view';
const IL2CPP_MARKER = 'RN_UNITY_SKIP_IL2CPP_PATCH';

function unityLibraryExists(projectRoot) {
  return fs.existsSync(
    path.join(projectRoot, 'unity', 'builds', 'android', 'unityLibrary', 'build.gradle')
  );
}

function stripUnityLauncherIntentFilter(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    return;
  }

  const contents = fs.readFileSync(manifestPath, 'utf8');
  const cleaned = contents.replace(/<intent-filter[\s\S]*?<\/intent-filter>\s*/g, '');
  if (cleaned !== contents) {
    fs.writeFileSync(manifestPath, cleaned);
  }
}

function patchGradleFile(filePath, transform) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const original = fs.readFileSync(filePath, 'utf8');
  const updated = transform(original);
  if (updated !== original) {
    fs.writeFileSync(filePath, updated);
  }
}

function patchUnityExportGradle(projectRoot) {
  const unityRoot = path.join(projectRoot, 'unity', 'builds', 'android');
  const unityLibraryGradle = path.join(unityRoot, 'unityLibrary', 'build.gradle');
  const launcherGradle = path.join(unityRoot, 'launcher', 'build.gradle');
  const unityGradleProps = path.join(unityRoot, 'gradle.properties');

  patchGradleFile(unityLibraryGradle, (contents) => {
    let next = contents.replace(/\s*ndkPath\s+"[^"]+"\s*\n/g, '\n');

    if (!next.includes(IL2CPP_MARKER)) {
      next = next.replace(
        /(\s+doLast\s*\{)/,
        `$1
        // ${IL2CPP_MARKER}
        def prebuiltIl2Cpp = file("\${projectDir}/src/main/jniLibs/arm64-v8a/libil2cpp.so")
        if (prebuiltIl2Cpp.exists() && prebuiltIl2Cpp.length() > 100000) {
            println("Using prebuilt libil2cpp.so — skipping IL2CPP compile (required for EAS cloud builds).")
            return
        }`
      );
    }

    return next;
  });

  patchGradleFile(launcherGradle, (contents) =>
    contents.replace(/\s*ndkPath\s+"[^"]+"\s*\n/g, '\n')
  );

  patchGradleFile(unityGradleProps, (contents) =>
    contents
      .split('\n')
      .filter(
        (line) =>
          !line.startsWith('unity.androidSdkPath=') &&
          !line.startsWith('unity.androidNdkPath=') &&
          !line.startsWith('unity.jdkPath=') &&
          !line.startsWith('unityProjectPath=') &&
          !line.startsWith('unity.projectPath=')
      )
      .join('\n')
  );

  const localProps = path.join(unityRoot, 'local.properties');
  if (fs.existsSync(localProps)) {
    fs.unlinkSync(localProps);
  }

  const depthManifest = path.join(unityRoot, 'unityLibrary', 'src', 'main', 'AndroidManifest.xml');
  if (fs.existsSync(depthManifest)) {
    let manifest = fs.readFileSync(depthManifest, 'utf8');
    manifest = manifest.replace(
      /android:name="com\.google\.ar\.core\.depth"\s+android:required="true"/,
      'android:name="com.google.ar.core.depth" android:required="false"'
    );
    fs.writeFileSync(depthManifest, manifest);
  }
}

const withUnityAndroidGradle = (config) => {
  config = withSettingsGradle(config, (config) => {
    const unityInclude = "include ':unityLibrary'";
    const unityProjectDir =
      "project(':unityLibrary').projectDir = new File('../unity/builds/android/unityLibrary')";

    if (!config.modResults.contents.includes(unityInclude)) {
      config.modResults.contents = config.modResults.contents.replace(
        /include\s+['"]:app['"]/,
        `${unityInclude}\n${unityProjectDir}\ninclude ':app'`
      );
    }

    return config;
  });

  config = withProjectBuildGradle(config, (config) => {
    const flatDirBlock = `flatDir {\n            dirs "\${project(':unityLibrary').projectDir}/libs"\n        }`;

    if (!config.modResults.contents.includes("project(':unityLibrary')")) {
      config.modResults.contents = config.modResults.contents.replace(
        /allprojects\s*\{\s*repositories\s*\{/,
        `allprojects {\n    repositories {\n        ${flatDirBlock}`
      );
    }

    return config;
  });

  config = withGradleProperties(config, (config) => {
    const props = config.modResults;
    const hasStreamingAssets = props.some(
      (item) => item.type === 'property' && item.key === 'unityStreamingAssets'
    );

    if (!hasStreamingAssets) {
      props.push({ type: 'property', key: 'unityStreamingAssets', value: '.unity3d' });
    }

    return config;
  });

  config = withStringsXml(config, (config) => {
    const existing = config.modResults?.resources?.string ?? [];
    const items = Array.isArray(existing) ? existing : existing ? [existing] : [];
    const hasGameView = items.some(
      (item) => item.$?.name === 'game_view_content_description'
    );

    if (!hasGameView) {
      config.modResults = AndroidConfig.Strings.setStringItem(
        [
          {
            $: { name: 'game_view_content_description', translatable: 'false' },
            _: GAME_VIEW_STRING,
          },
        ],
        config.modResults
      );
    }

    return config;
  });

  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;

      if (!unityLibraryExists(projectRoot)) {
        console.warn(
          '[withUnity] unityLibrary not found at frontend/unity/builds/android/unityLibrary — export ARFurniture from Unity first.'
        );
        return config;
      }

      patchUnityExportGradle(projectRoot);
      patchAzesmwayUPlayer(projectRoot);

      const manifestPath = path.join(
        projectRoot,
        'unity',
        'builds',
        'android',
        'unityLibrary',
        'src',
        'main',
        'AndroidManifest.xml'
      );
      stripUnityLauncherIntentFilter(manifestPath);

      return config;
    },
  ]);
};

/** Unity 6-safe UPlayer: never use constructors()[1]. */
function patchAzesmwayUPlayer(projectRoot) {
  const src = path.join(
    projectRoot,
    'patches',
    'azesmway-react-native-unity',
    'UPlayer.java'
  );
  const dest = path.join(
    projectRoot,
    'node_modules',
    '@azesmway',
    'react-native-unity',
    'android',
    'src',
    'main',
    'java',
    'com',
    'azesmwayreactnativeunity',
    'UPlayer.java'
  );

  if (!fs.existsSync(src) || !fs.existsSync(path.dirname(dest))) {
    return;
  }

  fs.copyFileSync(src, dest);
  console.log('[withUnity] Applied Unity 6 UPlayer constructor patch');
}

const withUnity = (config) => withUnityAndroidGradle(config);

module.exports = createRunOncePlugin(withUnity, 'withUnity');
