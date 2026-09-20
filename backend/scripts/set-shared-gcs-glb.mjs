/**
 * Point every active furniture glbUrl at the shared Abu Dhabi Sofa GCS asset.
 * Usage: node scripts/set-shared-gcs-glb.mjs
 */

import '../src/loadEnv.js';
import Furniture from '../src/models/Furniture.js';
import { connectMongoDB, disconnectMongoDB } from '../src/db/mongodb.js';

const GLB =
  process.env.FURNITURE_SHARED_GLB_URL?.trim() ||
  'https://storage.googleapis.com/unity-furniture-assets-01/Abu%20Dhabi%20Sofa.glb';

await connectMongoDB();

const result = await Furniture.updateMany({ active: true }, { $set: { glbUrl: GLB } });
const sample = await Furniture.find({ active: true }).select('id displayName glbUrl').limit(5).lean();

console.log(
  JSON.stringify(
    {
      glbUrl: GLB,
      matched: result.matchedCount,
      modified: result.modifiedCount,
      sample,
    },
    null,
    2,
  ),
);

await disconnectMongoDB();
