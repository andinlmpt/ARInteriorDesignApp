/**
 * Worker process: optimizes one GLB file and reports back over IPC.
 * Started by services/modelOptimization.js — args: <input path> <output path>.
 */

import { readFile, writeFile } from 'fs/promises';
import { optimizeModel } from '../services/modelOptimizer.js';

const [inputPath, outputPath] = process.argv.slice(2);

try {
  const result = await optimizeModel(await readFile(inputPath));
  await writeFile(outputPath, result.buffer);
  process.send?.({ ok: true, optimized: result.optimized, before: result.before, after: result.after });
} catch (error) {
  process.send?.({ ok: false, error: error.message });
  process.exitCode = 1;
}
