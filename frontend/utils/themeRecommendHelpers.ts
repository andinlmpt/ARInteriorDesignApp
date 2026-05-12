/**
 * Theme Recommend Helper Functions
 * Utility functions for theme recommendations
 */

import { Alert } from 'react-native';
import type { RoomType } from '@/types/theme-recommendation';
import type { BudgetValue } from '@/config/themeRecommend.config';
import type { CostBreakdown } from '@/types/theme-recommend-ui';
import {
  BUDGET_MULTIPLIERS,
  ROOM_BASE_COSTS,
  COLOR_NAMES,
  ERROR_MESSAGES,
} from '@/config/themeRecommend.config';

// ============================================================================
// TYPE SAFE VALUE GETTERS
// ============================================================================

/**
 * Safely gets a number value, returning default if not a number
 */
export function getNumberValue(value: unknown, defaultValue = 0): number {
  return typeof value === 'number' && !isNaN(value) ? value : defaultValue;
}

/**
 * Calculates confidence percentage from a confidence value (0-1)
 */
export function getConfidencePercentage(confidence: unknown): string {
  const num = getNumberValue(confidence, 0);
  return (num * 100).toFixed(0);
}

/**
 * Safely gets an array, returning empty array if invalid
 */
export function getArrayValue<T>(value: unknown, defaultValue: T[] = []): T[] {
  return Array.isArray(value) ? value : defaultValue;
}

/**
 * Safely gets a string value, returning default if not a string
 */
export function getStringValue(value: unknown, defaultValue = ''): string {
  return typeof value === 'string' ? value : defaultValue;
}

/**
 * Formats array items into a comma-separated string
 */
export function formatArrayItems(items: unknown[], maxItems?: number): string {
  const validItems = getArrayValue(items);
  const limitedItems = maxItems ? validItems.slice(0, maxItems) : validItems;
  return limitedItems.length > 0 ? limitedItems.join(', ') : 'Not specified';
}

// ============================================================================
// COST CALCULATION
// ============================================================================

/**
 * Calculate estimated cost breakdown based on budget range and room type
 */
export function calculateEstimatedCost(
  budgetRange: BudgetValue,
  roomType: RoomType
): CostBreakdown {
  const base = ROOM_BASE_COSTS[roomType];
  const multiplier = BUDGET_MULTIPLIERS[budgetRange];

  const breakdown = {
    furniture: Math.round(base.furniture * multiplier),
    decor: Math.round(base.decor * multiplier),
    lighting: Math.round(base.lighting * multiplier),
    paint: Math.round(base.paint * multiplier),
    accessories: Math.round(base.accessories * multiplier),
  };

  const total = Object.values(breakdown).reduce((sum, cost) => sum + cost, 0);

  return { total, breakdown };
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

/**
 * Get color name from hex code
 */
export function getColorName(hex: string): string {
  return COLOR_NAMES[hex.toUpperCase()] || hex;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Standardized error handling utility
 */
export function handleError(error: unknown, context: string, userMessage?: string): string {
  let errorMessage: string;
  
  if (error instanceof Error) {
    const errorMsg = error.message.toLowerCase();
    if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
      errorMessage = ERROR_MESSAGES.TIMEOUT_ERROR;
    } else if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('connection')) {
      errorMessage = ERROR_MESSAGES.NETWORK_ERROR;
    } else {
      errorMessage = userMessage || error.message || ERROR_MESSAGES.UNKNOWN_ERROR;
    }
  } else if (typeof error === 'string') {
    errorMessage = userMessage || error || ERROR_MESSAGES.UNKNOWN_ERROR;
  } else {
    errorMessage = userMessage || ERROR_MESSAGES.UNKNOWN_ERROR;
  }

  console.error(`[ThemeRecommend] ${context}:`, errorMessage, error);
  return errorMessage;
}

/**
 * Standardized error alert utility
 */
export function showErrorAlert(
  error: unknown,
  context: string,
  userMessage?: string,
  onRetry?: () => void
): void {
  const errorMessage = handleError(error, context, userMessage);
  
  const buttons: Array<{ text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }> = [
    { text: 'OK', style: 'default' },
  ];
  
  if (onRetry) {
    buttons.unshift({ text: 'Retry', onPress: onRetry });
  }
  
  Alert.alert('Error', errorMessage, buttons);
}

// ============================================================================
// DEBOUNCE UTILITY
// ============================================================================

/**
 * Debounce utility function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

// ============================================================================
// HTML EXPORT GENERATORS
// ============================================================================

/**
 * Generate HTML for collection export
 */
export function generateCollectionHTML(collection: {
  name: string;
  description?: string;
  createdAt: number;
  themes: Array<{
    name: string;
    description?: string;
    colorPalette?: string[];
    materials?: string[];
    decorItems?: string[];
    moodScore?: number;
    styleScore?: number;
    roomScore?: number;
    confidence?: number;
  }>;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${collection.name} - Theme Collection</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      padding: 40px;
      max-width: 1200px;
      margin: 0 auto;
      background: #FFFFFF;
      color: #1a1a1a;
    }
    h1 { color: #1a1a1a; font-size: 32px; margin-bottom: 8px; }
    .collection-meta { color: #666; font-size: 14px; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #E5E5E5; }
    .theme-card { background: #FFFFFF; border: 1px solid #E5E5E5; border-radius: 12px; padding: 24px; margin-bottom: 24px; page-break-inside: avoid; }
    .theme-name { font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; }
    .theme-description { color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 20px; }
    .color-palette { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
    .color-swatch { width: 60px; height: 60px; border-radius: 8px; border: 1px solid #E5E5E5; }
    .section { margin-bottom: 16px; }
    .section-label { font-weight: 600; color: #1a1a1a; margin-bottom: 8px; font-size: 14px; }
    .section-value { color: #666; font-size: 14px; }
    .scores { display: flex; gap: 24px; margin-top: 16px; }
    .score-item { text-align: center; }
    .score-value { font-size: 24px; font-weight: 700; color: #007AFF; }
    .score-label { font-size: 12px; color: #666; margin-top: 4px; }
    @media print { body { padding: 20px; } .theme-card { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <h1>${collection.name}</h1>
  <div class="collection-meta">
    ${collection.description ? `<p>${collection.description}</p>` : ''}
    <p>Created: ${new Date(collection.createdAt).toLocaleDateString()}</p>
    <p>Themes: ${collection.themes.length}</p>
  </div>
  
  ${collection.themes.map(theme => `
    <div class="theme-card">
      <div class="theme-name">${theme.name}</div>
      <div class="theme-description">${theme.description || 'No description'}</div>
      
      <div class="section">
        <div class="section-label">Color Palette</div>
        <div class="color-palette">
          ${(theme.colorPalette || []).map(color => `<div class="color-swatch" style="background-color: ${color};" title="${color}"></div>`).join('')}
        </div>
      </div>
      
      ${theme.materials && theme.materials.length > 0 ? `
        <div class="section">
          <div class="section-label">Materials</div>
          <div class="section-value">${theme.materials.join(', ')}</div>
        </div>
      ` : ''}
      
      ${theme.decorItems && theme.decorItems.length > 0 ? `
        <div class="section">
          <div class="section-label">Decor Items</div>
          <div class="section-value">${theme.decorItems.slice(0, 5).join(', ')}</div>
        </div>
      ` : ''}
      
      <div class="scores">
        ${typeof theme.moodScore === 'number' ? `<div class="score-item"><div class="score-value">${Math.round(theme.moodScore)}</div><div class="score-label">Mood</div></div>` : ''}
        ${typeof theme.styleScore === 'number' ? `<div class="score-item"><div class="score-value">${Math.round(theme.styleScore)}</div><div class="score-label">Style</div></div>` : ''}
        ${typeof theme.roomScore === 'number' ? `<div class="score-item"><div class="score-value">${Math.round(theme.roomScore)}</div><div class="score-label">Room Fit</div></div>` : ''}
        ${typeof theme.confidence === 'number' ? `<div class="score-item"><div class="score-value">${Math.round(theme.confidence * 100)}%</div><div class="score-label">Match</div></div>` : ''}
      </div>
    </div>
  `).join('')}
  
  <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #E5E5E5; text-align: center; color: #999; font-size: 12px;">
    Generated by AR Interior Design App - ${new Date().toLocaleDateString()}
  </div>
</body>
</html>
  `;
}

