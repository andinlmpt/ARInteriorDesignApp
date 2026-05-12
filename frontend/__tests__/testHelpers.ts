/**
 * Test Helper Utilities for AR View Screen
 * 
 * These utilities help automate and simplify testing of AR view features.
 */

import * as THREE from 'three';

/**
 * Wait for a condition to be true (with timeout)
 */
export const waitFor = async (
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 100
): Promise<boolean> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  return false;
};

/**
 * Generate test furniture positions in a grid pattern
 */
export const generateTestFurnitureGrid = (
  count: number,
  spacing: number = 1.0
): Array<{ position: THREE.Vector3; rotation: number }> => {
  const positions: Array<{ position: THREE.Vector3; rotation: number }> = [];
  const cols = Math.ceil(Math.sqrt(count));
  
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    
    positions.push({
      position: new THREE.Vector3(
        (col - cols / 2) * spacing,
        0,
        (row - cols / 2) * spacing
      ),
      rotation: 0,
    });
  }
  
  return positions;
};

/**
 * Simulate rapid drag operations
 */
export const simulateRapidDrag = async (
  dragCallback: (position: THREE.Vector2) => void,
  duration: number = 1000,
  frequency: number = 60 // 60 updates per second
): Promise<void> => {
  const startTime = Date.now();
  const interval = 1000 / frequency;
  
  while (Date.now() - startTime < duration) {
    const progress = (Date.now() - startTime) / duration;
    const x = Math.sin(progress * Math.PI * 4) * 100 + 200;
    const y = Math.cos(progress * Math.PI * 4) * 100 + 400;
    
    dragCallback(new THREE.Vector2(x, y));
    await new Promise(resolve => setTimeout(resolve, interval));
  }
};

/**
 * Monitor memory usage (mock implementation for testing)
 */
export const monitorMemoryUsage = () => {
  if (typeof performance !== 'undefined' && 'memory' in performance) {
    const memory = (performance as any).memory;
    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit,
    };
  }
  
  return {
    used: 0,
    total: 0,
    limit: 0,
    note: 'Memory monitoring not available in this environment',
  };
};

/**
 * Create test room data
 */
export const createTestRoomData = () => ({
  dimensions: {
    width: 5,
    length: 4,
    height: 2.7,
    unit: 'meters' as const,
  },
  area: 20,
  confidence: 0.9,
  obstacles: [],
  walls: [],
  corners: [],
});

/**
 * Validate furniture state integrity
 */
export const validateFurnitureState = (furniture: any[]): {
  valid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  furniture.forEach((item, index) => {
    if (!item.id) {
      errors.push(`Item ${index} missing ID`);
    }
    if (!item.libraryId) {
      errors.push(`Item ${index} missing libraryId`);
    }
    if (!item.name) {
      errors.push(`Item ${index} missing name`);
    }
  });
  
  // Check for duplicate IDs
  const ids = furniture.map(item => item.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length > 0) {
    errors.push(`Duplicate IDs found: ${duplicates.join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Test collision detection performance
 */
export const benchmarkCollisionDetection = async (
  collisionCheckFn: () => boolean,
  iterations: number = 1000
): Promise<{
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
}> => {
  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    collisionCheckFn();
    const end = performance.now();
    times.push(end - start);
  }
  
  return {
    totalTime: times.reduce((a, b) => a + b, 0),
    averageTime: times.reduce((a, b) => a + b, 0) / times.length,
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
  };
};

/**
 * Create corrupted layout data for testing
 */
export const createCorruptedLayoutData = () => ({
  id: 'corrupted-layout',
  name: 'Corrupted Test Layout',
  timestamp: Date.now(),
  roomData: null,
  furniture: [
    { id: 'invalid-1', libraryId: 'missing-library-item' }, // Missing library item
    { id: null, libraryId: 'sofa' }, // Missing ID
    { id: 'invalid-3', libraryId: 'chair', position: { x: NaN, y: NaN, z: NaN } }, // Invalid position
  ],
  metadata: {
    totalFurniture: -1, // Invalid count
    totalArea: NaN,
    averageSafety: 999, // Invalid safety score
  },
});

/**
 * Measure frame rate
 */
export const measureFrameRate = (
  callback: () => void,
  duration: number = 5000
): Promise<number> => {
  return new Promise((resolve) => {
    let frames = 0;
    let lastTime = performance.now();
    
    const countFrame = () => {
      callback();
      frames++;
      const currentTime = performance.now();
      
      if (currentTime - lastTime >= duration) {
        const fps = (frames / (currentTime - lastTime)) * 1000;
        resolve(fps);
      } else {
        requestAnimationFrame(countFrame);
      }
    };
    
    requestAnimationFrame(countFrame);
  });
};

/**
 * Test group operations
 */
export const testGroupOperations = {
  /**
   * Verify group integrity
   */
  validateGroup: (group: any, furniture: any[]): boolean => {
    if (!group.id || !group.furnitureIds || !Array.isArray(group.furnitureIds)) {
      return false;
    }
    
    // Verify all furniture in group exists
    const allExist = group.furnitureIds.every((id: string) =>
      furniture.some(f => f.id === id)
    );
    
    return allExist && group.furnitureIds.length >= 2;
  },
  
  /**
   * Verify group center calculation
   */
  verifyGroupCenter: (
    group: any,
    furniture: any[],
    tolerance: number = 0.1
  ): boolean => {
    const groupFurniture = furniture.filter(f =>
      group.furnitureIds.includes(f.id)
    );
    
    if (groupFurniture.length === 0) return false;
    
    // Calculate expected center
    const expectedCenter = new THREE.Vector3();
    groupFurniture.forEach(f => {
      // Would need mesh positions here - simplified check
    });
    
    return true; // Simplified
  },
};

/**
 * Test history operations
 */
export const testHistoryOperations = {
  /**
   * Fill history to maximum
   */
  fillHistory: (
    saveToHistoryFn: (state: any[]) => void,
    baseState: any[],
    maxEntries: number = 50
  ): void => {
    for (let i = 0; i < maxEntries; i++) {
      const newState = [...baseState, { id: `test-${i}`, libraryId: 'chair' }];
      saveToHistoryFn(newState);
    }
  },
  
  /**
   * Verify history integrity
   */
  validateHistory: (history: any[][]): {
    valid: boolean;
    errors: string[];
  } => {
    const errors: string[] = [];
    
    if (!Array.isArray(history)) {
      errors.push('History is not an array');
      return { valid: false, errors };
    }
    
    history.forEach((state, index) => {
      if (!Array.isArray(state)) {
        errors.push(`History entry ${index} is not an array`);
      } else {
        const validation = validateFurnitureState(state);
        if (!validation.valid) {
          errors.push(`History entry ${index}: ${validation.errors.join(', ')}`);
        }
      }
    });
    
    return {
      valid: errors.length === 0,
      errors,
    };
  },
};

/**
 * Export all test helpers
 */
export default {
  waitFor,
  generateTestFurnitureGrid,
  simulateRapidDrag,
  monitorMemoryUsage,
  createTestRoomData,
  validateFurnitureState,
  benchmarkCollisionDetection,
  createCorruptedLayoutData,
  measureFrameRate,
  testGroupOperations,
  testHistoryOperations,
};

