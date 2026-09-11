/**
 * Project types for AR Interior Design App
 */

export type RoomType = 
  | 'Living Room'
  | 'Bedroom'
  | 'Kitchen'
  | 'Bathroom'
  | 'Office'
  | 'Dining Room'
  | 'Kids Room'
  | 'Outdoor';

export type ProjectStatus = 'draft' | 'in-progress' | 'completed';

/** How the project was created / last updated. */
export type ProjectSource = 'manual' | 'unity-export';

export type DesignStyle = 
  | 'Modern'
  | 'Contemporary'
  | 'Minimalist'
  | 'Scandinavian'
  | 'Industrial'
  | 'Bohemian'
  | 'Traditional'
  | 'Rustic'
  | 'Mid-Century'
  | 'Eclectic';

export interface ProjectDimensions {
  length: number; // in meters
  width: number;  // in meters
  height: number; // in meters
}

/** Metadata for a Unity ARDesignScene 3D layout export (.glb). */
export interface UnityLayoutExportMeta {
  path: string;
  fileName: string;
  byteLength: number;
  furnitureCount: number;
  roomMeshCount: number;
  exportedAt: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  roomType: RoomType;
  style?: DesignStyle;
  dimensions?: ProjectDimensions;
  status: ProjectStatus;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
  budget?: {
    min: number;
    max: number;
  };
  tags?: string[];
  source?: ProjectSource;
  /** Absolute file path / metadata when exported from Unity. */
  unityExport?: UnityLayoutExportMeta;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  roomType: RoomType;
  style?: DesignStyle;
  dimensions?: ProjectDimensions;
  budget?: {
    min: number;
    max: number;
  };
}
