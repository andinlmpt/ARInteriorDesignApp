import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

globalThis.self = globalThis;

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, '../assets/models/furniture');
const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.glb'));
const loader = new GLTFLoader();

function measure(buf) {
  return new Promise((resolve, reject) => {
    loader.parse(
      buf,
      '',
      (gltf) => {
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = box.getSize(new THREE.Vector3());
        resolve({ x: size.x, y: size.y, z: size.z });
      },
      reject
    );
  });
}

for (const f of files) {
  const fileBuf = fs.readFileSync(path.join(dir, f));
  const buf = fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength);
  try {
    const s = await measure(buf);
    console.log(
      JSON.stringify({
        file: f,
        width_m: +s.x.toFixed(4),
        height_m: +s.y.toFixed(4),
        depth_m: +s.z.toFixed(4),
        width_cm: Math.round(s.x * 100),
        height_cm: Math.round(s.y * 100),
        depth_cm: Math.round(s.z * 100),
      })
    );
  } catch (e) {
    console.log(JSON.stringify({ file: f, error: String(e?.message || e) }));
  }
}
