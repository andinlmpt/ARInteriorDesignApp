/**
 * Phase 1 design-a-room contracts.
 * Shared by preferences, layout picker, and the AI generate API.
 */

export const DESIGN_ROOM_TYPES = [
  { id: 'Bedroom', label: 'Bedroom', emoji: '🛏️', icon: 'bed-outline', hint: 'Rest & sleep' },
  { id: 'Living Room', label: 'Living Room', emoji: '🛋️', icon: 'tv-outline', hint: 'Lounge & relax' },
  { id: 'Kitchen', label: 'Kitchen', emoji: '🍳', icon: 'cafe-outline', hint: 'Cook & prep' },
  { id: 'Dining Room', label: 'Dining Room', emoji: '🍽️', icon: 'restaurant-outline', hint: 'Meals & gatherings' },
  { id: 'Office', label: 'Office', emoji: '💼', icon: 'briefcase-outline', hint: 'Work & focus' },
  { id: 'Bathroom', label: 'Bathroom', emoji: '🚿', icon: 'water-outline', hint: 'Bath & refresh' },
] as const;

export const DESIGN_STYLES = [
  { id: 'Minimalist', label: 'Minimalist', emoji: '⬜', icon: 'square-outline', hint: 'Clean & simple' },
  { id: 'Modern', label: 'Modern', emoji: '🏢', icon: 'cube-outline', hint: 'Sleek lines' },
  { id: 'Scandinavian', label: 'Scandinavian', emoji: '🌲', icon: 'leaf-outline', hint: 'Light & natural' },
  { id: 'Industrial', label: 'Industrial', emoji: '⚙️', icon: 'construct-outline', hint: 'Raw metal & wood' },
  { id: 'Contemporary', label: 'Contemporary', emoji: '🏙️', icon: 'color-palette-outline', hint: 'Current & bold' },
  { id: 'Traditional', label: 'Traditional', emoji: '🏛️', icon: 'library-outline', hint: 'Classic & warm' },
  { id: 'Rustic', label: 'Rustic', emoji: '🌲', icon: 'bonfire-outline', hint: 'Cozy & earthy' },
] as const;

export type DesignRoomType = (typeof DESIGN_ROOM_TYPES)[number]['id'];
export type DesignStyle = (typeof DESIGN_STYLES)[number]['id'];

/** Used when the Mongo catalog is empty. */
export const FALLBACK_REQUIRED_ITEMS: DesignRequiredItem[] = [
  { id: 'bed', label: 'Bed', category: 'beds', pricePhp: 14999, rooms: ['Bedroom'] },
  { id: 'desk', label: 'Study table', category: 'desk', pricePhp: 6999, rooms: ['Bedroom', 'Office'] },
  { id: 'sofa', label: 'Sofa', category: 'sofa', pricePhp: 18999, rooms: ['Living Room', 'Office'] },
  { id: 'dining-table', label: 'Dining table', category: 'table', pricePhp: 9999, rooms: ['Dining Room', 'Kitchen'] },
  { id: 'wardrobe', label: 'Wardrobe', category: 'storage', pricePhp: 11999, rooms: ['Bedroom'] },
  { id: 'chair', label: 'Chair', category: 'chair', pricePhp: 2499 },
];

export const DEFAULT_BUDGET_PHP = 30000;
export const MIN_BUDGET_PHP = 5000;
export const MAX_BUDGET_PHP = 500000;
export const BUDGET_STEP_PHP = 5000;

export interface DesignRequiredItem {
  id: string;
  label: string;
  category: string;
  subtitle?: string;
  pricePhp?: number;
  /** Undefined = fits every style. */
  styles?: string[];
  /** Undefined = fits every room. */
  rooms?: string[];
  thumbnailUrl?: string;
  quantity?: number;
}

export interface DesignPreferencesInput {
  roomType: DesignRoomType | string;
  style: DesignStyle | string;
  budgetPhp: number;
  requiredItemIds: string[];
  requiredCategories: string[];
  notes?: string;
}

export interface DesignLayoutItem {
  instanceId: string;
  furnitureId: string;
  displayName: string;
  glbUrl?: string;
  category: string;
  width: number;
  height: number;
  depth: number;
  localPosition: { x: number; y: number; z: number };
  rotationY: number;
  color?: string;
  pricePhp: number;
  /** Planner role, e.g. 'bed', 'nightstand', 'rug'. */
  role?: string;
}

export interface DesignProposalV2 {
  id: string;
  title: string;
  description: string;
  items: DesignLayoutItem[];
  score: {
    overall: number;
    space: number;
    flow: number;
    budgetFit: number;
    clearance?: number;
    relations?: number;
    wall?: number;
    balance?: number;
  };
  totalPhp: number;
  overBudget: boolean;
  colorPalette: string[];
  pros?: string[];
  cons?: string[];
}

/** A layout item after the user moved, recoloured or replaced it in AR (step 6). */
export interface CustomizedLayoutItem extends DesignLayoutItem {
  /** "#RRGGBB" tint chosen in AR; absent keeps the model's own colours. */
  tintHex?: string;
}

/** The user's edited version of a proposal, in the planner's room-local frame. */
export interface CustomizedDesignLayout {
  proposalId: string;
  sessionId?: string;
  measurementId?: string;
  projectId?: string;
  room: { width: number; length: number; height: number };
  items: CustomizedLayoutItem[];
  totalPhp: number;
  updatedAt: number;
  title?: string;
}

export interface SavedFinalDesignResponse {
  sessionId: string;
  status: 'finalized';
  projectId?: string;
  measurementId?: string;
  roomDimensions?: { width: number; height: number; depth: number };
  preferences?: DesignPreferencesInput;
  finalLayout: CustomizedDesignLayout & { title?: string };
  finalizedAt?: number;
}

export interface DesignFlowGenerationResult {
  sessionId?: string;
  measurementId?: string;
  projectId?: string;
  room: {
    width: number;
    length: number;
    height: number;
  };
  preferences: DesignPreferencesInput;
  proposals: DesignProposalV2[];
}
