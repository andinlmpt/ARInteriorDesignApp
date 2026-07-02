/**
 * Static server for Unity WebGL builds with Brotli (.br) support.
 * Plain `serve` does not set Content-Encoding: br, which breaks Unity WebGL.
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.UNITY_SERVE_PORT || 3456);
const HOST = process.env.UNITY_SERVE_HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.data': 'application/octet-stream',
};

function contentType(filePath) {
  if (filePath.endsWith('.js.br')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.wasm.br')) return 'application/wasm';
  if (filePath.endsWith('.data.br')) return 'application/octet-stream';
  const base = filePath.endsWith('.br') ? filePath.slice(0, -3) : filePath;
  const ext = path.extname(base).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = decoded === '/' ? '/index.html' : decoded;
  const resolved = path.normalize(path.join(ROOT, relative));

  if (!resolved.startsWith(ROOT)) {
    return null;
  }

  return resolved;
}

const server = http.createServer((req, res) => {
  const filePath = resolveFile(req.url || '/');

  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const stat = fs.statSync(filePath);
  const headers = {
    'Content-Type': contentType(filePath),
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
  };

  if (filePath.endsWith('.br')) {
    headers['Content-Encoding'] = 'br';
  }

  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`Unity WebGL server: http://localhost:${PORT}`);
  console.log(`On your phone (same Wi-Fi): http://<your-pc-ip>:${PORT}`);
});
