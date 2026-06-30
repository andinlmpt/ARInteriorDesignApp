const https = require('https');
const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, 'frontend', 'assets', 'models', 'furniture');

if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
}

const models = [
    {
        name: 'accent-chair.glb',
        url: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/SheenChair.glb'
    },
    {
        name: 'coffee-table.glb',
        // Using a boombox as a placeholder for a table since it's a small PBR object
        url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoomBox/glTF-Binary/BoomBox.glb'
    },
    {
        name: 'sofa-modern.glb',
        // Using a Duck as a placeholder for a sofa since Shoe 404'd
        url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb'
    }
];

function download(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                download(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

async function run() {
    console.log('Downloading 3D models...');
    for (const model of models) {
        const dest = path.join(modelsDir, model.name);
        console.log(`Downloading ${model.name}...`);
        try {
            await download(model.url, dest);
            console.log(`Successfully downloaded ${model.name}`);
        } catch (err) {
            console.error(`Error downloading ${model.name}:`, err);
        }
    }
    console.log('Done!');
}

run();
