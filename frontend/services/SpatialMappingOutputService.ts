import {
  SpatialMappingResult,
  VisualizationOverlay,
  SpatialMappingOutput,
  BoundingBox,
  SpatialPoint,
} from '@/types/spatial-mapping';

/**
 * SpatialMappingOutputService
 * Handles visualization overlays and structured JSON output for spatial mapping
 */
export class SpatialMappingOutputService {
  /**
   * Generate visualization overlay with bounding boxes, labels, and distance indicators
   * @param result - Spatial mapping result
   * @returns Visualization overlay data
   */
  generateVisualizationOverlay(result: SpatialMappingResult): VisualizationOverlay {
    const boundingBoxes: VisualizationOverlay['boundingBoxes'] = [];
    const distanceIndicators: VisualizationOverlay['distanceIndicators'] = [];
    const labels: VisualizationOverlay['labels'] = [];

    if (!result.roomData) {
      return { boundingBoxes, distanceIndicators, labels };
    }

    // Generate bounding boxes for obstacles
    result.roomData.obstacles.forEach((obstacle) => {
      boundingBoxes.push({
        box: obstacle.boundingBox,
        label: `${obstacle.label} (${obstacle.distanceFromCamera.toFixed(1)}m)`,
        color: this.getColorForObstacle(obstacle.type),
        confidence: obstacle.confidence,
      });

      // Add label overlay
      labels.push({
        position: {
          x: obstacle.boundingBox.x + obstacle.boundingBox.width / 2,
          y: obstacle.boundingBox.y - 10,
        },
        text: obstacle.label,
        color: this.getColorForObstacle(obstacle.type),
      });
    });

    // Generate distance indicators between camera and obstacles
    const cameraPosition: SpatialPoint = { x: 0, y: 1.5, z: 0 };
    
    result.roomData.obstacles.forEach((obstacle) => {
      distanceIndicators.push({
        from: cameraPosition,
        to: obstacle.coordinates,
        distance: obstacle.distanceFromCamera,
        label: `${obstacle.distanceFromCamera.toFixed(2)}m`,
      });
    });

    // Add room dimension indicators
    if (result.roomData.walls.length >= 2) {
      const wall1 = result.roomData.walls[0];
      const wall2 = result.roomData.walls[1];
      
      distanceIndicators.push({
        from: wall1.startPoint,
        to: wall1.endPoint,
        distance: wall1.length,
        label: `${wall1.length.toFixed(2)}m`,
      });

      distanceIndicators.push({
        from: wall2.startPoint,
        to: wall2.endPoint,
        distance: wall2.length,
        label: `${wall2.length.toFixed(2)}m`,
      });
    }

    return {
      boundingBoxes,
      distanceIndicators,
      labels,
    };
  }

  /**
   * Generate structured JSON output for spatial mapping results
   * @param result - Spatial mapping result
   * @returns Structured JSON output
   */
  generateJSONOutput(result: SpatialMappingResult): SpatialMappingOutput {
    if (!result.roomData) {
      throw new Error('No room data available');
    }

    const output: SpatialMappingOutput = {
      roomDimensions: {
        width: result.roomData.dimensions.width,
        length: result.roomData.dimensions.length,
        height: result.roomData.dimensions.height,
        unit: result.roomData.dimensions.unit,
        accuracy: result.roomData.dimensions.accuracy,
      },
      detectedObstacles: result.roomData.obstacles.map((obstacle) => ({
        id: obstacle.id,
        type: obstacle.type,
        label: obstacle.label,
        position: {
          x: obstacle.coordinates.x,
          y: obstacle.coordinates.y,
          z: obstacle.coordinates.z,
        },
        distance: obstacle.distanceFromCamera,
        confidence: obstacle.confidence,
        boundingBox: obstacle.boundingBox,
      })),
      spatialMap: {
        type: result.spatialMap3D ? '3D' : 'heatmap',
        data: result.spatialMap3D || result.heatmap,
        timestamp: result.timestamp,
      },
      metadata: {
        scanDuration: 0, // Will be filled by caller
        fps: result.fps,
        confidence: result.confidence,
        timestamp: result.timestamp,
      },
    };

    return output;
  }

  /**
   * Export spatial mapping result as JSON string
   * @param result - Spatial mapping result
   * @param scanDuration - Scan duration in milliseconds
   * @returns JSON string
   */
  exportAsJSON(result: SpatialMappingResult, scanDuration: number): string {
    const output = this.generateJSONOutput(result);
    output.metadata.scanDuration = scanDuration;
    return JSON.stringify(output, null, 2);
  }

  /**
   * Export spatial mapping result as downloadable file
   * @param result - Spatial mapping result
   * @param scanDuration - Scan duration in milliseconds
   * @param filename - Output filename
   */
  async exportAsFile(
    result: SpatialMappingResult,
    scanDuration: number,
    filename: string = 'spatial-mapping-result.json'
  ): Promise<void> {
    const jsonString = this.exportAsJSON(result, scanDuration);
    
    // For React Native, you would use react-native-fs or similar
    // This is a placeholder for the export logic
    console.log(`Exporting to ${filename}:`, jsonString);
    
    // In a real implementation, save to file system
    // await FileSystem.writeAsStringAsync(filePath, jsonString);
  }

  /**
   * Render overlay on canvas or image
   * @param overlay - Visualization overlay
   * @param imageWidth - Image width
   * @param imageHeight - Image height
   * @returns Rendered overlay instructions
   */
  renderOverlay(
    overlay: VisualizationOverlay,
    imageWidth: number,
    imageHeight: number
  ): Array<{
    type: 'box' | 'line' | 'text';
    data: any;
  }> {
    const instructions: Array<{ type: 'box' | 'line' | 'text'; data: any }> = [];

    // Render bounding boxes
    overlay.boundingBoxes.forEach((bbox) => {
      instructions.push({
        type: 'box',
        data: {
          x: bbox.box.x,
          y: bbox.box.y,
          width: bbox.box.width,
          height: bbox.box.height,
          color: bbox.color,
          label: bbox.label,
          confidence: bbox.confidence,
          strokeWidth: 2,
        },
      });
    });

    // Render distance indicators
    overlay.distanceIndicators.forEach((indicator) => {
      // Project 3D points to 2D screen coordinates
      const from2D = this.project3DTo2D(indicator.from, imageWidth, imageHeight);
      const to2D = this.project3DTo2D(indicator.to, imageWidth, imageHeight);

      instructions.push({
        type: 'line',
        data: {
          x1: from2D.x,
          y1: from2D.y,
          x2: to2D.x,
          y2: to2D.y,
          color: '#00FF00',
          strokeWidth: 2,
          dashed: true,
        },
      });

      // Add distance label at midpoint
      const midX = (from2D.x + to2D.x) / 2;
      const midY = (from2D.y + to2D.y) / 2;

      instructions.push({
        type: 'text',
        data: {
          x: midX,
          y: midY,
          text: indicator.label,
          color: '#00FF00',
          fontSize: 14,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
        },
      });
    });

    // Render labels
    overlay.labels.forEach((label) => {
      instructions.push({
        type: 'text',
        data: {
          x: label.position.x,
          y: label.position.y,
          text: label.text,
          color: label.color,
          fontSize: 12,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
        },
      });
    });

    return instructions;
  }

  /**
   * Generate summary report of spatial mapping
   * @param result - Spatial mapping result
   * @returns Summary report
   */
  generateSummaryReport(result: SpatialMappingResult): {
    roomInfo: string;
    obstaclesSummary: string;
    accuracyInfo: string;
    performanceInfo: string;
  } {
    if (!result.roomData) {
      throw new Error('No room data available');
    }

    const roomInfo = `Room Dimensions: ${result.roomData.dimensions.width}m (W) × ${result.roomData.dimensions.length}m (L) × ${result.roomData.dimensions.height}m (H)\n` +
      `Floor Area: ${result.roomData.area} m²\n` +
      `Volume: ${result.roomData.volume} m³\n` +
      `Floor Type: ${result.roomData.floorType}\n` +
      `Natural Light: ${result.roomData.naturalLight}`;

    const obstaclesSummary = `Total Obstacles: ${result.roomData.obstacles.length}\n` +
      result.roomData.obstacles.map((obs) => 
        `- ${obs.label} (${obs.type}): ${obs.distanceFromCamera.toFixed(2)}m away, ${(obs.confidence * 100).toFixed(0)}% confidence`
      ).join('\n');

    const accuracyInfo = `Measurement Accuracy: ±${(100 - result.roomData.dimensions.accuracy).toFixed(1)}%\n` +
      `Overall Confidence: ${(result.confidence * 100).toFixed(1)}%\n` +
      `Detected Planes: ${result.planes.length}\n` +
      `Depth Map: ${result.depthMap ? 'Available' : 'Not Available'}`;

    const performanceInfo = `FPS: ${result.fps.toFixed(1)}\n` +
      `Timestamp: ${new Date(result.timestamp).toISOString()}\n` +
      `Spatial Map 3D: ${result.spatialMap3D ? `${result.spatialMap3D.points.length} points` : 'Not Generated'}\n` +
      `Heatmap: ${result.heatmap ? `${result.heatmap.width}x${result.heatmap.height} cells` : 'Not Generated'}`;

    return {
      roomInfo,
      obstaclesSummary,
      accuracyInfo,
      performanceInfo,
    };
  }

  /**
   * Validate spatial mapping output quality
   * @param result - Spatial mapping result
   * @returns Validation result with warnings/errors
   */
  validateOutput(result: SpatialMappingResult): {
    isValid: boolean;
    warnings: string[];
    errors: string[];
  } {
    const warnings: string[] = [];
    const errors: string[] = [];

    if (!result.roomData) {
      errors.push('No room data available');
      return { isValid: false, warnings, errors };
    }

    // Check confidence levels
    if (result.confidence < 0.5) {
      errors.push(`Low overall confidence: ${(result.confidence * 100).toFixed(1)}%`);
    } else if (result.confidence < 0.7) {
      warnings.push(`Moderate confidence: ${(result.confidence * 100).toFixed(1)}%`);
    }

    // Check FPS
    if (result.fps < 15) {
      warnings.push(`Low FPS: ${result.fps.toFixed(1)} (target: 15-30 FPS)`);
    }

    // Check room dimensions reasonability
    const dims = result.roomData.dimensions;
    if (dims.width < 1 || dims.width > 50) {
      warnings.push(`Unusual room width: ${dims.width}m`);
    }
    if (dims.length < 1 || dims.length > 50) {
      warnings.push(`Unusual room length: ${dims.length}m`);
    }
    if (dims.height < 2 || dims.height > 10) {
      warnings.push(`Unusual room height: ${dims.height}m`);
    }

    // Check for missing data
    if (!result.depthMap) {
      warnings.push('Depth map not available');
    }
    if (!result.spatialMap3D) {
      warnings.push('3D spatial map not generated');
    }
    if (!result.heatmap) {
      warnings.push('Heatmap not generated');
    }

    // Check obstacle detection
    if (result.roomData.obstacles.length === 0) {
      warnings.push('No obstacles detected');
    }

    const isValid = errors.length === 0;

    return { isValid, warnings, errors };
  }

  // Private helper methods

  private getColorForObstacle(type: string): string {
    const colors: Record<string, string> = {
      Window: '#87CEEB',
      Door: '#8B4513',
      Furniture: '#654321',
      Radiator: '#FF6347',
      'Electrical Outlet': '#FFD700',
      Other: '#808080',
    };
    return colors[type] || '#808080';
  }

  private project3DTo2D(
    point: SpatialPoint,
    imageWidth: number,
    imageHeight: number
  ): { x: number; y: number } {
    // Simple perspective projection
    // In real implementation, use actual camera intrinsics
    const focalLength = 500;
    const depth = point.z || 1;

    const x = (point.x * focalLength) / depth + imageWidth / 2;
    const y = imageHeight / 2 - (point.y * focalLength) / depth;

    return {
      x: Math.max(0, Math.min(imageWidth, x)),
      y: Math.max(0, Math.min(imageHeight, y)),
    };
  }
}

// Export singleton instance
export const spatialMappingOutputService = new SpatialMappingOutputService();
