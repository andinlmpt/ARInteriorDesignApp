/**
 * Decompress Unity WebGL Brotli (.br) assets for mobile WebView compatibility.
 * Android/iOS WebViews often fail to load .br files over HTTP.
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(ROOT, 'Build');
const INDEX_HTML = path.join(ROOT, 'index.html');

function decompressFile(brPath) {
  const outPath = brPath.replace(/\.br$/, '');
  const compressed = fs.readFileSync(brPath);
  const decompressed = zlib.brotliDecompressSync(compressed);
  fs.writeFileSync(outPath, decompressed);
  const inMb = (compressed.length / 1024 / 1024).toFixed(2);
  const outMb = (decompressed.length / 1024 / 1024).toFixed(2);
  console.log(`  ${path.basename(brPath)} (${inMb} MB) -> ${path.basename(outPath)} (${outMb} MB)`);
  return outPath;
}

function updateIndexHtml() {
  let html = fs.readFileSync(INDEX_HTML, 'utf8');
  html = html
    .replace(/ARInteriorDesignApp-main\.data\.br/g, 'ARInteriorDesignApp-main.data')
    .replace(/ARInteriorDesignApp-main\.framework\.js\.br/g, 'ARInteriorDesignApp-main.framework.js')
    .replace(/ARInteriorDesignApp-main\.wasm\.br/g, 'ARInteriorDesignApp-main.wasm');
  fs.writeFileSync(INDEX_HTML, html);
  console.log('Updated index.html to use uncompressed asset URLs.');
}

if (!fs.existsSync(BUILD_DIR)) {
  console.error(`Build folder not found: ${BUILD_DIR}`);
  process.exit(1);
}

const brFiles = fs.readdirSync(BUILD_DIR).filter((f) => f.endsWith('.br'));
if (brFiles.length === 0) {
  console.log('No .br files found — build may already be decompressed.');
  process.exit(0);
}

console.log('Decompressing Unity WebGL build for mobile WebView...\n');
for (const file of brFiles) {
  decompressFile(path.join(BUILD_DIR, file));
}

updateIndexHtml();
console.log('\nDone. Restart: npm run serve:unity');
