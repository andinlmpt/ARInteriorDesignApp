/**
 * Saved room measurements from AR room scan (Unity ARDesignScene).
 */

import mongoose from 'mongoose';

const vec3Schema = new mongoose.Schema(
  {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    z: { type: Number, default: 0 },
  },
  { _id: false },
);

const wallSchema = new mongoose.Schema(
  {
    index: { type: Number, default: 0 },
    start: vec3Schema,
    end: vec3Schema,
    length: { type: Number, default: 0 },
  },
  { _id: false },
);

const openingSchema = new mongoose.Schema(
  {
    id: { type: String, trim: true, default: '' },
    type: { type: String, enum: ['door', 'window'], required: true },
    wallIndex: { type: Number, default: 0 },
    offsetAlongWall: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    sillHeight: { type: Number, default: 0 },
    swing: { type: String, enum: ['left', 'right', 'none'], default: 'none' },
  },
  { _id: false },
);

const obstacleSchema = new mongoose.Schema(
  {
    id: { type: String, trim: true, default: '' },
    type: { type: String, trim: true, default: 'other' },
    center: vec3Schema,
    size: vec3Schema,
    yaw: { type: Number, default: 0 },
  },
  { _id: false },
);

const roomMeasurementSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      trim: true,
      default: '',
    },
    projectId: {
      type: String,
      trim: true,
      default: '',
    },
    name: {
      type: String,
      trim: true,
      default: 'Room scan',
    },
    width: { type: Number, required: true },
    depth: { type: Number, required: true },
    height: { type: Number, required: true },
    floorAreaSqm: { type: Number, default: 0 },
    wallHeight: { type: Number, default: 0 },
    dimensionLabel: {
      type: String,
      trim: true,
      default: '',
    },
    boundsMin: vec3Schema,
    boundsMax: vec3Schema,
    floorPolygon: {
      type: [vec3Schema],
      default: [],
    },
    floorY: { type: Number, default: 0 },
    perimeterM: { type: Number, default: 0 },
    volumeM3: { type: Number, default: 0 },
    walls: { type: [wallSchema], default: [] },
    openings: { type: [openingSchema], default: [] },
    obstacles: { type: [obstacleSchema], default: [] },
    validation: {
      isValid: { type: Boolean, default: true },
      errors: { type: [String], default: [] },
    },
    scanMetadata: {
      planeCount: { type: Number, default: 0 },
      meshChunkCount: { type: Number, default: 0 },
      horizontalAreaSqm: { type: Number, default: 0 },
      verticalAreaSqm: { type: Number, default: 0 },
      cornerCount: { type: Number, default: 0 },
      source: { type: String, trim: true, default: 'unity-ar' },
    },
    confirmedAt: {
      type: Date,
      default: Date.now,
    },
    /** Linked Unity 3D layout export (.glb) — device-local path for preview. */
    exportPath: {
      type: String,
      trim: true,
      default: '',
    },
    exportFileName: {
      type: String,
      trim: true,
      default: '',
    },
    exportByteLength: {
      type: Number,
      default: 0,
    },
    exportFurnitureCount: {
      type: Number,
      default: 0,
    },
    exportedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'room_measurements',
  },
);

roomMeasurementSchema.index({ userId: 1, createdAt: -1 });
roomMeasurementSchema.index({ projectId: 1, createdAt: -1 });

const RoomMeasurement =
  mongoose.models.RoomMeasurement ||
  mongoose.model('RoomMeasurement', roomMeasurementSchema);

export default RoomMeasurement;
