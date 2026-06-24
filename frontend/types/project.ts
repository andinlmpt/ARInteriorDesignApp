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
