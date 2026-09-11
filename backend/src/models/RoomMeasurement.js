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
