/**
 * Live Scan Helper Utilities
 * Helper functions for live scanning UI and calculations
 */

import { QUALITY_THRESHOLDS, QUALITY_COLORS, UI_CONSTANTS } from '@/config/liveScan.config';
import { enhancedImageAnalysisService } from '@/services/EnhancedImageAnalysisService';

/**
 * Get quality color based on confidence level
 */
export function getQualityColor(confidence: number): string {
  if (confidence > QUALITY_THRESHOLDS.HIGH) {
    return QUALITY_COLORS.HIGH;
  }
  if (confidence > QUALITY_THRESHOLDS.MEDIUM) {
    return QUALITY_COLORS.MEDIUM;
  }
  return QUALITY_COLORS.LOW;
}

/**
 * Calculate progress bar width percentage
 */
export function calculateProgressWidth(coverage: number): number {
  return Math.min(
    UI_CONSTANTS.MAX_PROGRESS_WIDTH,
    Math.max(UI_CONSTANTS.MIN_PROGRESS_WIDTH, coverage * 100)
  );
}

/**
 * Format scan duration for display
 */
export function formatScanDuration(durationMs: number): string {
  return (durationMs / 1000).toFixed(1) + 's';
}

/**
 * Format time since last update
 */
export function formatTimeSince(timestamp: number | null): string {
  if (!timestamp) return '—';
  return `${Math.round((Date.now() - timestamp) / 1000)}s`;
}

/**
 * Get accuracy metrics from service
 */
export function getAccuracyMetrics() {
  return enhancedImageAnalysisService.getAccuracyMetrics();
}

/**
 * Calculate trend bar height
 */
export function calculateTrendBarHeight(coverage: number, baseHeight: number = 16, maxAddition: number = 50): number {
  return baseHeight + coverage * maxAddition;
}

