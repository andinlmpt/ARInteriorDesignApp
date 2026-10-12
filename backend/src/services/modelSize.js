/**
 * Measures a stored furniture model (local upload or Google Cloud Storage) by reading only
 * its header, so large GLBs stay cheap. See glbBounds.js for the measurement itself.
 */

import { open } from 'fs/promises';
import { basename, join } from 'path';
import { measureModelBuffer } from './glbBounds.js';
import { UPLOAD_ROOT } from './uploadService.js';

const GLB_HEADER_BYTES = 20;
/** glTF JSON headers are small; anything bigger is not worth reading for a size check. */
const MAX_JSON_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10000;
const GLB_MAGIC = 0x46546c67;

/** Header + JSON chunk of a .glb, or the whole (small) .gltf text, from a byte reader. */
async function readModelHeader(readBytes) {
  const head = await readBytes(0, GLB_HEADER_BYTES);
  if (!head || head.length < GLB_HEADER_BYTES) return null;
  if (head.readUInt32LE(0) !== GLB_MAGIC) {
    return readBytes(0, MAX_JSON_BYTES);
  }
  const jsonLength = head.readUInt32LE(12);
  if (jsonLength > MAX_JSON_BYTES) return null;
  const json = await readBytes(GLB_HEADER_BYTES, jsonLength);
  return json ? Buffer.concat([head, json]) : null;
}

async function measureLocalFile(filePath) {
  const handle = await open(filePath, 'r');
  try {
    return measureModelBuffer(await readModelHeader(async (offset, length) => {
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buffer, 0, length, offset);
      return buffer.subarray(0, bytesRead);
    }));
  } finally {
    await handle.close();
  }
}

/** Reads a byte range over HTTP, stopping early even if the server ignores the Range header. */
async function fetchRange(url, offset, length) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Range: `bytes=${offset}-${offset + length - 1}` },
      signal: controller.signal,
    });
    if (!res.ok || !res.body) return null;
    const skip = res.status === 206 ? 0 : offset;
    const chunks = [];
    let received = 0;
    for await (const chunk of res.body) {
      chunks.push(Buffer.from(chunk));
      received += chunk.length;
      if (received >= skip + length) break;
    }
    controller.abort();
    return Buffer.concat(chunks).subarray(skip, skip + length);
  } finally {
    clearTimeout(timer);
  }
}

/** Local file for one of our own upload URLs (…/uploads/glb/<name>), or null. */
function localUploadPath(url) {
  const match = /\/uploads\/glb\/([^/?#]+)$/.exec(url.pathname);
  if (!match) return null;
  // basename() keeps a crafted name from escaping the uploads folder.
  return join(UPLOAD_ROOT, 'glb', basename(decodeURIComponent(match[1])));
}

/**
 * Real-world size { width, height, depth } in metres of the model at `glbUrl`, or null when
 * it can't be measured. Only our own uploads, Cloudinary and Google Cloud Storage URLs are read.
 */
export async function measureModelAtUrl(glbUrl) {
  let url;
  try {
    url = new URL(String(glbUrl || ''), 'http://localhost');
  } catch {
    return null;
  }

  try {
    const local = localUploadPath(url);
    if (local) return await measureLocalFile(local);

    if (url.protocol === 'https:' && (url.hostname === 'storage.googleapis.com' || url.hostname === 'res.cloudinary.com')) {
      return measureModelBuffer(await readModelHeader((offset, length) => fetchRange(url.href, offset, length)));
    }
  } catch (error) {
    console.warn(`[ModelSize] Could not measure ${url.href}:`, error.message);
  }
  return null;
}
