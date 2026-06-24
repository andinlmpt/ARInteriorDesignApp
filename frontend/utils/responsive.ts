/**
 * Responsive utilities for mobile-friendly layouts
 */

import { Dimensions, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Breakpoints
const BREAKPOINTS = {
  small: 375,   // iPhone SE, small phones
  medium: 414,  // iPhone 11 Pro Max, most phones
  large: 768,   // Tablets
};

// Check if device is small screen
export const isSmallScreen = SCREEN_WIDTH < BREAKPOINTS.medium;
export const isTablet = SCREEN_WIDTH >= BREAKPOINTS.large;

/**
 * Get responsive padding based on screen size
 */
export function getResponsivePadding(base: number): number {
  if (isSmallScreen) {
    return Math.max(8, base * 0.75); // Reduce padding on small screens
  }
  if (isTablet) {
    return base * 1.25; // Increase padding on tablets
  }
  return base;
}

/**
 * Get responsive horizontal padding
 */
export function getHorizontalPadding(base: number = 24): number {
  if (isSmallScreen) {
    return 16; // Consistent 16px on small screens
  }
  if (isTablet) {
    return 32; // More padding on tablets
  }
  return base;
}

/**
 * Get responsive font size
 */
export function getResponsiveFontSize(base: number): number {
  if (isSmallScreen) {
    return Math.max(12, base * 0.9);
  }
  if (isTablet) {
    return base * 1.1;
  }
  return base;
}

/**
 * Get responsive button height
 */
export function getResponsiveButtonHeight(base: number = 50): number {
  if (isSmallScreen) {
    return Math.max(44, base * 0.9);
  }
  return base;
}

/**
 * Get responsive icon size
 */
export function getResponsiveIconSize(base: number): number {
  if (isSmallScreen) {
    return Math.max(16, base * 0.85);
  }
  return base;
}

/**
 * Get responsive spacing
 */
export function getResponsiveSpacing(base: number): number {
  if (isSmallScreen) {
    return Math.max(4, base * 0.8);
  }
  return base;
}

/**
 * Screen dimensions
 */
export const screenDimensions = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  isSmall: isSmallScreen,
  isTablet,
  isMobile: !isTablet,
};
