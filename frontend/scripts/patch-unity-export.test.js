const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { patchUnityExportGradle } = require('../plugins/withUnity');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-unity-patch-'));
  const library = path.join(root, 'unity/builds/android/unityLibrary');
  fs.mkdirSync(path.join(library, 'src/main'), { recursive: true });
  fs.mkdirSync(path.join(root, 'android'));
  fs.writeFileSync(path.join(root, 'android/gradle.properties'), 'hermesEnabled=true\n');
  fs.writeFileSync(path.join(root, 'unity/builds/android/gradle.properties'), 'unity.androidSdkPath=old-sdk\nunity.androidNdkPath=old-ndk\n');
  fs.writeFileSync(path.join(library, 'build.gradle'), 'ndkPath "old-ndk"\ntasks.register(\'buildIl2Cpp\') {\n    doLast {\n        compileIl2Cpp()\n    }\n}\n');
  fs.writeFileSync(path.join(library, 'src/main/AndroidManifest.xml'), '<manifest><application android:enableOnBackInvokedCallback="true"><activity><intent-filter>launcher</intent-filter></activity><uses-feature android:name="com.google.ar.core.depth" android:required="true" /></application></manifest>');
  return { root, library };
}

test('local fresh export receives toolchain paths and compiles current IL2CPP', () => {
  const { root, library } = fixture();
  const previous = { ...process.env };
  try {
    process.env.UNITY_USE_PREBUILT_IL2CPP = 'false';
    process.env.ANDROID_SDK_ROOT = root;
    process.env.UNITY_ANDROID_NDK_PATH = library;
    patchUnityExportGradle(root);
    const properties = fs.readFileSync(path.join(root, 'android/gradle.properties'), 'utf8');
    assert.ok(properties.includes(`unity.androidSdkPath=${root.replace(/\\/g, '/')}`));
    assert.ok(properties.includes(`unity.androidNdkPath=${library.replace(/\\/g, '/')}`));
    assert.ok(properties.includes('unity.usePrebuiltIl2Cpp=false'));
    const gradle = fs.readFileSync(path.join(library, 'build.gradle'), 'utf8');
    assert.ok(gradle.includes('inputs.property("usePrebuiltIl2Cpp"'));
    assert.ok(gradle.includes('project.findProperty("unity.usePrebuiltIl2Cpp")'));
    assert.ok(!gradle.includes('ndkPath "old-ndk"'));
    const manifest = fs.readFileSync(path.join(library, 'src/main/AndroidManifest.xml'), 'utf8');
    assert.ok(!manifest.includes('intent-filter'));
    assert.ok(!manifest.includes('enableOnBackInvokedCallback'));
    assert.ok(manifest.includes('android:required="false"'));
    patchUnityExportGradle(root);
    assert.equal(fs.readFileSync(path.join(library, 'build.gradle'), 'utf8'), gradle);
    assert.equal(fs.readFileSync(path.join(root, 'android/gradle.properties'), 'utf8'), properties);
  } finally {
    process.env = previous;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('EAS profiles explicitly opt into the prebuilt mode without workstation paths', () => {
  const { root } = fixture();
  const previous = { ...process.env };
  try {
    process.env.UNITY_USE_PREBUILT_IL2CPP = 'true';
    patchUnityExportGradle(root);
    const properties = fs.readFileSync(path.join(root, 'android/gradle.properties'), 'utf8');
    assert.ok(properties.includes('unity.usePrebuiltIl2Cpp=true'));
    assert.ok(!properties.includes('unity.androidSdkPath'));
    const profiles = require('../eas.json').build;
    for (const profile of Object.values(profiles)) assert.equal(profile.env.UNITY_USE_PREBUILT_IL2CPP, 'true');
  } finally {
    process.env = previous;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('upgrades the old automatic-prebuilt patch instead of keeping a stale compile skip', () => {
  const { root, library } = fixture();
  try {
    const gradleFile = path.join(library, 'build.gradle');
    fs.writeFileSync(gradleFile, `tasks.register('buildIl2Cpp') {
    doLast {
        // RN_UNITY_SKIP_IL2CPP_PATCH
        def prebuiltIl2Cpp = file("prebuilt.so")
        if (prebuiltIl2Cpp.exists() && prebuiltIl2Cpp.length() > 100000) {
            return
        }
    }
}`);
    patchUnityExportGradle(root);
    const patched = fs.readFileSync(gradleFile, 'utf8');
    assert.ok(patched.includes('project.findProperty("unity.usePrebuiltIl2Cpp")'));
    assert.ok(patched.includes('Prebuilt IL2CPP is missing'));
    assert.ok(!patched.includes('if (prebuiltIl2Cpp.exists()'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
