const path = require('path');
const { patchUnityExportGradle } = require('../plugins/withUnity');
patchUnityExportGradle(path.resolve(process.argv[2] || path.join(__dirname, '..')));
