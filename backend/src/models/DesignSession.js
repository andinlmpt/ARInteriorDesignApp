import mongoose from 'mongoose';

const DesignSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Optional for guests or testing
  },
  roomDimensions: {
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    depth: { type: Number, required: true },
  },
  detectedObstacles: [{ type: String }],
  preferences: {
    roomType: { type: String, required: true },
    style: { type: String, required: true },
    availableFloorSpace: { type: Number },
  },
  generatedLayouts: {
    type: Array, // Array of layouts JSON
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('DesignSession', DesignSessionSchema);
