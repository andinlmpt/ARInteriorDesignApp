import mongoose from 'mongoose';

const vec3Schema = new mongoose.Schema(
  {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    z: { type: Number, default: 0 },
  },
  { _id: false },
);

const DesignSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  projectId: {
    type: String,
    trim: true,
    default: '',
  },
  measurementId: {
    type: String,
    trim: true,
    default: '',
  },
  roomDimensions: {
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    depth: { type: Number, required: true },
  },
  floorPolygon: {
    type: [vec3Schema],
    default: [],
  },
  detectedObstacles: [{ type: String }],
  preferences: {
    roomType: { type: String, required: true },
    style: { type: String, required: true },
    availableFloorSpace: { type: Number },
    budgetPhp: { type: Number, default: 0 },
    requiredItemIds: { type: [String], default: [] },
    requiredCategories: { type: [String], default: [] },
    notes: { type: String, trim: true, default: '' },
  },
  generatedLayouts: {
    type: Array,
    default: [],
  },
  proposals: {
    type: Array,
    default: [],
  },
  selectedProposalId: {
    type: String,
    trim: true,
    default: '',
  },
  /** User-edited layout after AR customize (step 6), saved on finalize (step 7). */
  finalLayout: {
    proposalId: { type: String, trim: true, default: '' },
    title: { type: String, trim: true, default: '' },
    items: { type: Array, default: [] },
    totalPhp: { type: Number, default: 0 },
    updatedAt: { type: Date },
  },
  finalizedAt: {
    type: Date,
  },
  status: {
    type: String,
    trim: true,
    default: 'generated',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('DesignSession', DesignSessionSchema);
