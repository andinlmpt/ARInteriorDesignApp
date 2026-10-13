/**
 * Runs model optimization (modelOptimizer.js) in a separate process, one model at a time,
 * so a huge upload can't exhaust the server's memory or block other requests.
 */

import { fork } from 'child_process';
import { readFile, rm, stat } from 'fs/promises';
import { fileURLToPath } from 'url';
import { OPTIMIZE_ABOVE_BYTES } from './modelOptimizer.js';

const WORKER = fileURLToPath(new URL('../workers/optimizeModel.js', import.meta.url));
const TIMEOUT_MS = 3 * 60 * 1000;
const WORKER_MEMORY_MB = 3072;

let queue = Promise.resolve();

function runWorker(inputPath) {
  const outputPath = `${inputPath}.optimized.glb`;
  return new Promise((resolve, reject) => {
    const child = fork(WORKER, [inputPath, outputPath], {
      execArgv: [`--max-old-space-size=${WORKER_MEMORY_MB}`],
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    });
    let report = null;
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk).slice(-2000);
    });
    child.on('message', (message) => {
      report = message;
    });

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Optimizing the 3D model took too long. Export a lighter version and try again.'));
    }, TIMEOUT_MS);

    child.on('exit', async () => {
      clearTimeout(timer);
      if (!report?.ok) {
        if (!report) console.warn('[ModelOptimization] Worker failed:', stderr.trim());
        await rm(outputPath, { force: true });
        reject(new Error(report?.error
          ? `Couldn't optimize the 3D model: ${report.error.replace(/\.+$/, '')}.`
          : 'The 3D model is too heavy to optimize here. Export a lighter version and try again.'));
        return;
      }
      try {
        const buffer = await readFile(outputPath);
        resolve({ buffer, optimized: report.optimized, before: report.before, after: report.after });
      } catch (error) {
        reject(error);
      } finally {
        await rm(outputPath, { force: true });
      }
    });
  });
}

/**
 * Returns the model ready to store: { buffer, optimized, before, after }.
 * Files at or under 8 MB are returned unchanged without starting a worker.
 */
export async function optimizeModelFile(inputPath) {
  const { size } = await stat(inputPath);
  if (size <= OPTIMIZE_ABOVE_BYTES) {
    return { buffer: await readFile(inputPath), optimized: false, before: { bytes: size }, after: { bytes: size } };
  }

  const run = queue.then(() => runWorker(inputPath));
  queue = run.catch(() => undefined);
  return run;
}
