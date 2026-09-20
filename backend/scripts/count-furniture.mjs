import '../src/loadEnv.js';
import Furniture from '../src/models/Furniture.js';
import { connectMongoDB, disconnectMongoDB } from '../src/db/mongodb.js';

await connectMongoDB();
const total = await Furniture.countDocuments({});
const active = await Furniture.countDocuments({ active: true });
const inactive = await Furniture.countDocuments({ active: false });
const withGlb = await Furniture.countDocuments({
  glbUrl: { $exists: true, $nin: [null, ''] },
});
const activeItems = await Furniture.find({ active: true })
  .select('id displayName')
  .sort({ sortOrder: 1 })
  .lean();
const inactiveItems = await Furniture.find({ active: false })
  .select('id displayName')
  .sort({ id: 1 })
  .lean();

console.log(
  JSON.stringify(
    {
      total,
      active,
      inactive,
      withGlbUrl: withGlb,
      activeIds: activeItems.map((i) => i.id),
      inactiveIds: inactiveItems.map((i) => i.id),
    },
    null,
    2,
  ),
);
await disconnectMongoDB();
