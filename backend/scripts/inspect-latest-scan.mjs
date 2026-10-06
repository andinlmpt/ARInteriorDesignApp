import 'dotenv/config';
import { connectMongoDB, disconnectMongoDB } from '../src/db/mongodb.js';
import RoomMeasurement from '../src/models/RoomMeasurement.js';
import { buildRoomFeatures } from '../src/services/roomFeatures.js';

await connectMongoDB();
const docs = await RoomMeasurement.find().sort({ createdAt: -1 }).limit(3).lean();
for (const d of docs) {
  const room = { width: d.width, length: d.depth ?? d.length, height: d.height };
  const features = buildRoomFeatures(room, d);
  console.log(JSON.stringify({
    id: String(d._id),
    name: d.roomName ?? d.name,
    createdAt: d.createdAt,
    width: d.width, depth: d.depth, length: d.length, height: d.height,
    polygon: (d.floorPolygon || []).map((p) => [+p.x.toFixed(2), +p.z.toFixed(2)]),
    openings: (d.openings || []).map((o) => ({ type: o.type, wall: o.wallIndex, off: o.offsetAlongWall, w: o.width })),
    obstacles: (d.obstacles || []).map((o) => ({ type: o.type, c: o.center, s: o.size })),
    features: {
      polygon: features.polygon ? 'used' : 'ignored',
      doorZones: features.doorZones,
      windowZones: features.windowZones,
      obstacles: features.obstacles,
    },
  }, null, 1));
}
await disconnectMongoDB();
