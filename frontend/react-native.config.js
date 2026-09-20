/**
 * Conditionally disable @azesmway/react-native-unity autolinking when the
 * Unity Android export is not present (e.g. icon-only EAS builds).
 */

const fs = require('fs');
const path = require('path');

const unityLibraryGradle = path.join(
  __dirname,
  'unity',
  'builds',
  'android',
  'unityLibrary',
  'build.gradle'
);

const unityAvailable = fs.existsSync(unityLibraryGradle);

module.exports = {
  dependencies: unityAvailable
    ? {}
    : {
        '@azesmway/react-native-unity': {
          platforms: {
            android: null,
            ios: null,
          },
        },
      },
};
