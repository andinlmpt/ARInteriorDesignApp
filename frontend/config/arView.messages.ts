export const AR_VIEW_ERROR_MESSAGES = {
  CAMERA_PERMISSION_DENIED: 'Camera permission is required for AR features.',
  ROOM_DATA_PARSE_ERROR: 'Failed to load room data. Please try scanning again.',
  FURNITURE_PLACEMENT_ERROR: 'Unable to place furniture. Please try again.',
  ANCHOR_ERROR: 'Unable to establish anchor. Move device slowly and try again.',
} as const;

export const AR_VIEW_STATUS_AUTO_HIDE_DELAY = 3000;

export const AR_VIEW_LAYOUT_STORAGE_KEY = 'ar_furniture_layouts';
export const AR_VIEW_CURRENT_LAYOUT_KEY = 'ar_current_layout';
