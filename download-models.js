const https = require('https');
const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, 'frontend', 'assets', 'models', 'furniture');

if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

/** Reliable CC0 / sample models that work in Expo Go (bundled as assets). */
const models = [
  {
    name: 'accent-chair.glb',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/SheenChair/glTF-Binary/SheenChair.glb',
  },
  {
    name: 'dining-chair.glb',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/SheenChair/glTF-Binary/SheenChair.glb',
  },
  {
    name: 'sofa-modern.glb',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/SheenChair/glTF-Binary/SheenChair.glb',
  },
  {
    name: 'coffee-table.glb',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoxTextured/glTF-Binary/BoxTextured.glb',
  },
  {
    name: 'floor-lamp.glb',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/WaterBottle/glTF-Binary/WaterBottle.glb',
  },
  {
    name: 'bookshelf.glb',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Box/glTF-Binary/Box.glb',
  },
  {
    name: 'planter.glb',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Avocado/glTF-Binary/Avocado.glb',
  },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const request = (targetUrl) => {
      https
        .get(targetUrl, (response) => {
          if (response.statusCode === 301 || response.statusCode === 302) {
            file.close();
            fs.unlink(dest, () => {
              download(response.headers.location, dest).then(resolve).catch(reject);
            });
            return;
          }
          if (response.statusCode !== 200) {
            reject(new Error(`Failed to get '${targetUrl}' (${response.statusCode})`));
            return;
          }
          response.pipe(file);
          file.on('finish', () => {
            file.close(resolve);
          });
        })
        .on('error', (err) => {
          fs.unlink(dest, () => reject(err));
        });
    };
    request(url);
  });
}

async function run() {
  console.log('Downloading 3D furniture models to', modelsDir);
  for (const model of models) {
    const dest = path.join(modelsDir, model.name);
    console.log(`Downloading ${model.name}...`);
    try {
      await download(model.url, dest);
      const sizeKb = Math.round(fs.statSync(dest).size / 1024);
      console.log(`  OK ${model.name} (${sizeKb} KB)`);
    } catch (err) {
      console.error(`  FAIL ${model.name}:`, err.message);
    }
  }
  console.log('Done.');
}

run();
