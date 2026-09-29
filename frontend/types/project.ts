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

export type ProjectArMode = 'furniture' | 'measure';

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

/** A photo captured with the AR Furniture camera button. */
export interface ProjectPhoto {
  uri: string;
  fileName: string;
  byteLength: number;
  capturedAt: number;
  gallerySaved: boolean;
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
  /** AR flow the project was started in (Start new project tab). */
  arMode?: ProjectArMode;
  /** Absolute file path / metadata when exported from Unity. */
  unityExport?: UnityLayoutExportMeta;
  /** AR Furniture captures, newest last. */
  photos?: ProjectPhoto[];
}
