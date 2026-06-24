import { RoomData, SpatialPoint, WallBoundary, Obstacle } from '@/types/spatial-mapping';

/**
 * Professional Interior Design Analysis Service
 * Provides industry-standard calculations and analysis for interior designers
 */

export interface MaterialCalculation {
  paint: {
    wallArea: number; // square meters
    ceilingArea: number;
    primerLiters: number;
    paintLiters: number;
    coats: number;
  };
  flooring: {
    area: number;
    wasteFactor: number; // 5-10% typically
    totalRequired: number;
    estimatedCost?: number;
  };
  wallpaper: {
    wallArea: number;
    rollCoverage: number; // typically 5.2 m² per roll
    rollsRequired: number;
    wasteFactor: number;
  };
  baseboards: {
    perimeter: number;
    height: number; // meters
    linearMeters: number;
  };
  crownMolding: {
    perimeter: number;
    linearMeters: number;
  };
}

export interface DesignAnalysis {
  trafficFlow: {
    primaryPathways: Array<{
      from: string;
      to: string;
      width: number;
      clearance: number;
      rating: 'excellent' | 'good' | 'adequate' | 'poor';
    }>;
    bottlenecks: Array<{
      location: string;
      width: number;
      recommendation: string;
    }>;
    overallRating: 'excellent' | 'good' | 'adequate' | 'poor';
  };
  lighting: {
    naturalLightScore: number; // 0-100
    windowArea: number;
    recommendedArtificialLumens: number;
    lumensPerSquareMeter: number;
    recommendations: string[];
  };
  hvac: {
    volume: number; // cubic meters
    recommendedACUnits: number;
    recommendedCapacity: string; // BTU or kW
    airChangesPerHour: number;
    ventilationAdequacy: 'excellent' | 'good' | 'adequate' | 'poor';
  };
  furniturePlacement: {
    maxFurnitureArea: number; // square meters
    recommendedOccupancy: number;
    clearanceZones: Array<{
      type: string;
      area: number;
    }>;
  };
  accessibility: {
    wcagCompliance: {
      doorWidths: boolean;
      turningRadius: boolean;
      clearanceHeights: boolean;
      overall: 'compliant' | 'non-compliant' | 'partial';
    };
    adaCompliance?: {
      doorWidths: boolean;
      turningRadius: boolean;
      clearanceHeights: boolean;
      overall: 'compliant' | 'non-compliant' | 'partial';
    };
    recommendations: string[];
  };
  buildingCode: {
    egress: {
      windowEgress: boolean;
      doorEgress: boolean;
      compliance: boolean;
    };
    ventilation: {
      naturalVentilation: boolean;
      mechanicalVentilation: boolean;
      compliance: boolean;
    };
    ceilingHeight: {
      minimumMet: boolean;
      actualHeight: number;
      compliance: boolean;
    };
    overallCompliance: boolean;
    violations: string[];
  };
}

export interface ProfessionalReport {
  roomId: string;
  projectName: string;
  date: string;
  dimensions: {
    width: number;
    length: number;
    height: number;
    area: number;
    volume: number;
    accuracy: number;
  };
  materialCalculations: MaterialCalculation;
  designAnalysis: DesignAnalysis;
  recommendations: Array<{
    category: string;
    priority: 'high' | 'medium' | 'low';
    description: string;
    estimatedCost?: number;
  }>;
  measurements: {
    walls: Array<{
      id: string;
      orientation: string;
      length: number;
      height: number;
      area: number;
    }>;
    windows: Array<{
      id: string;
      width: number;
      height: number;
      area: number;
    }>;
    doors: Array<{
      id: string;
      width: number;
      height: number;
      area: number;
    }>;
  };
}

export class ProfessionalDesignService {
  private readonly MIN_DOOR_WIDTH_ADA = 0.815; // 32 inches in meters
  private readonly MIN_DOOR_WIDTH_EGRESS = 0.711; // 28 inches in meters
  private readonly MIN_CEILING_HEIGHT = 2.13; // 7 feet in meters
  private readonly MIN_TURNING_RADIUS = 1.52; // 60 inches in meters (ADA)
  private readonly PAINT_COVERAGE_PER_LITER = 10; // square meters per liter (typical)
  private readonly PRIMER_COVERAGE_PER_LITER = 12; // square meters per liter
  private readonly WALLPAPER_ROLL_COVERAGE = 5.2; // square meters per roll

  /**
   * Calculate material requirements for a room
   */
  calculateMaterials(roomData: RoomData): MaterialCalculation {
    const { dimensions, walls, obstacles } = roomData;
    const { width, length, height } = dimensions;
    
    // Calculate wall areas
    let totalWallArea = 0;
    const windowAreas: number[] = [];
    const doorAreas: number[] = [];

    walls.forEach(wall => {
      const wallArea = wall.length * height;
      totalWallArea += wallArea;
    });

    // Calculate window and door areas (subtract from wall area)
    obstacles.forEach(obstacle => {
      if (obstacle.type === 'Window') {
        const windowArea = this.parseSizeToArea(obstacle.size);
        windowAreas.push(windowArea);
        totalWallArea -= windowArea;
      } else if (obstacle.type === 'Door') {
        const doorArea = this.parseSizeToArea(obstacle.size);
        doorAreas.push(doorArea);
        totalWallArea -= doorArea;
      }
    });

    const ceilingArea = width * length;
    const perimeter = (width + length) * 2;

    // Calculate paint
    const wallPaintArea = Math.max(0, totalWallArea);
    const coats = 2; // standard 2 coats
    const paintLiters = Math.ceil((wallPaintArea / this.PAINT_COVERAGE_PER_LITER) * coats);
    const primerLiters = Math.ceil(wallPaintArea / this.PRIMER_COVERAGE_PER_LITER);

    // Calculate flooring (with 7% waste factor)
    const floorArea = width * length;
    const wasteFactor = 0.07;
    const flooringTotal = floorArea * (1 + wasteFactor);

    // Calculate wallpaper
    const wallpaperWallArea = wallPaintArea;
    const rollsRequired = Math.ceil((wallpaperWallArea / this.WALLPAPER_ROLL_COVERAGE) * 1.1); // 10% waste

    // Baseboards
    const baseboardHeight = 0.1; // 10cm typical
    const baseboardLinearMeters = perimeter;

    // Crown molding
    const crownMoldingLinearMeters = perimeter;

    return {
      paint: {
        wallArea: parseFloat(wallPaintArea.toFixed(2)),
        ceilingArea: parseFloat(ceilingArea.toFixed(2)),
        primerLiters: primerLiters,
        paintLiters: paintLiters,
        coats: coats,
      },
      flooring: {
        area: parseFloat(floorArea.toFixed(2)),
        wasteFactor: wasteFactor * 100,
        totalRequired: parseFloat(flooringTotal.toFixed(2)),
      },
      wallpaper: {
        wallArea: parseFloat(wallpaperWallArea.toFixed(2)),
        rollCoverage: this.WALLPAPER_ROLL_COVERAGE,
        rollsRequired: rollsRequired,
        wasteFactor: 10,
      },
      baseboards: {
        perimeter: parseFloat(perimeter.toFixed(2)),
        height: baseboardHeight,
        linearMeters: parseFloat(baseboardLinearMeters.toFixed(2)),
      },
      crownMolding: {
        perimeter: parseFloat(perimeter.toFixed(2)),
        linearMeters: parseFloat(crownMoldingLinearMeters.toFixed(2)),
      },
    };
  }

  /**
   * Perform comprehensive design analysis
   */
  analyzeDesign(roomData: RoomData): DesignAnalysis {
    const trafficFlow = this.analyzeTrafficFlow(roomData);
    const lighting = this.analyzeLighting(roomData);
    const hvac = this.analyzeHVAC(roomData);
    const furniturePlacement = this.analyzeFurniturePlacement(roomData);
    const accessibility = this.analyzeAccessibility(roomData);
    const buildingCode = this.analyzeBuildingCode(roomData);

    return {
      trafficFlow,
      lighting,
      hvac,
      furniturePlacement,
      accessibility,
      buildingCode,
    };
  }

  /**
   * Analyze traffic flow patterns
   */
  private analyzeTrafficFlow(roomData: RoomData) {
    const { dimensions, obstacles } = roomData;
    const { width, length } = dimensions;
    
    const doors = obstacles.filter(o => o.type === 'Door');
    const doorWidths = doors.map(d => this.parseSizeToWidth(d.size));
    const minDoorWidth = doors.length > 0 ? Math.min(...doorWidths) : 0.9;

    const primaryPathway = {
      from: 'Main Entry',
      to: 'Opposite Wall',
      width: minDoorWidth,
      clearance: Math.min(width, length) * 0.8, // 80% of smaller dimension
      rating: this.rateClearance(minDoorWidth, 0.9) as any,
    };

    // Detect bottlenecks (narrow passages)
    const bottlenecks: Array<{ location: string; width: number; recommendation: string }> = [];
    if (minDoorWidth < 0.8) {
      bottlenecks.push({
        location: 'Main Entry',
        width: minDoorWidth,
        recommendation: `Consider widening door to minimum 0.9m (36") for comfortable access`,
      });
    }

    const pathwayClearance = Math.min(width, length);
    if (pathwayClearance < 1.2) {
      bottlenecks.push({
        location: 'Room Center',
        width: pathwayClearance,
        recommendation: `Maintain minimum 1.2m (48") clearance for comfortable movement`,
      });
    }

    return {
      primaryPathways: [primaryPathway],
      bottlenecks,
      overallRating: this.calculateOverallRating(
        [primaryPathway.clearance, minDoorWidth],
        [0.9, 1.2]
      ) as any,
    };
  }

  /**
   * Analyze lighting conditions
   */
  private analyzeLighting(roomData: RoomData) {
    const { area, obstacles } = roomData;
    
    const windows = obstacles.filter(o => o.type === 'Window');
    const totalWindowArea = windows.reduce((sum, w) => {
      return sum + this.parseSizeToArea(w.size);
    }, 0);

    // Natural light score (0-100)
    // Good natural light: 10-20% of floor area is windows
    const windowToFloorRatio = totalWindowArea / area;
    const naturalLightScore = Math.min(100, (windowToFloorRatio / 0.15) * 100);

    // Recommended artificial lighting
    // General residential: 500-1000 lumens per square meter
    // Task areas: 1000-2000 lumens per square meter
    const recommendedLumens = area * 750; // 750 lumens/m² average
    const lumensPerSquareMeter = recommendedLumens / area;

    const recommendations: string[] = [];
    if (naturalLightScore < 50) {
      recommendations.push('Consider adding windows or enlarging existing windows for better natural light');
    }
    if (windowToFloorRatio < 0.1) {
      recommendations.push('Room requires significant artificial lighting - consider ambient and task lighting');
    }
    if (naturalLightScore > 80) {
      recommendations.push('Excellent natural light - supplement with adjustable artificial lighting for evening use');
    }

    return {
      naturalLightScore: Math.round(naturalLightScore),
      windowArea: parseFloat(totalWindowArea.toFixed(2)),
      recommendedArtificialLumens: Math.round(recommendedLumens),
      lumensPerSquareMeter: Math.round(lumensPerSquareMeter),
      recommendations,
    };
  }

  /**
   * Analyze HVAC requirements
   */
  private analyzeHVAC(roomData: RoomData) {
    const { volume } = roomData;
    
    // HVAC sizing: 20-25 BTU per cubic meter for cooling
    const btuPerCubicMeter = 22.5;
    const recommendedBTU = volume * btuPerCubicMeter;
    
    // Convert to kW (1 kW = 3412 BTU)
    const recommendedKW = recommendedBTU / 3412;
    
    // Air changes per hour (residential: 0.35-0.5 ACH)
    const airChangesPerHour = 0.4; // standard residential

    // Ventilation adequacy based on windows/doors
    const hasWindows = roomData.obstacles.some(o => o.type === 'Window');
    const hasMultipleDoors = roomData.obstacles.filter(o => o.type === 'Door').length > 1;
    const ventilationAdequacy = hasWindows && hasMultipleDoors ? 'excellent' : 
                                 hasWindows ? 'good' : 'adequate';

    return {
      volume: parseFloat(volume.toFixed(2)),
      recommendedACUnits: recommendedBTU > 18000 ? 2 : 1,
      recommendedCapacity: recommendedKW < 3 ? `${Math.round(recommendedKW * 10) / 10} kW (${Math.round(recommendedBTU)} BTU)` :
                        `${Math.round(recommendedKW)} kW (${Math.round(recommendedBTU)} BTU)`,
      airChangesPerHour: airChangesPerHour,
      ventilationAdequacy: ventilationAdequacy as any,
    };
  }

  /**
   * Analyze furniture placement potential
   */
  private analyzeFurniturePlacement(roomData: RoomData) {
    const { area } = roomData;
    
    // Furniture should occupy 30-40% of room area
    const maxFurnitureArea = area * 0.35;
    
    // Recommended occupancy based on room size
    // 10-15 square meters per person for comfortable living
    const recommendedOccupancy = Math.floor(area / 12);

    const clearanceZones = [
      { type: 'Traffic Pathways', area: area * 0.3 },
      { type: 'Furniture Placement', area: maxFurnitureArea },
      { type: 'Open Space', area: area * 0.35 },
    ];

    return {
      maxFurnitureArea: parseFloat(maxFurnitureArea.toFixed(2)),
      recommendedOccupancy: recommendedOccupancy,
      clearanceZones,
    };
  }

  /**
   * Analyze accessibility compliance
   */
  private analyzeAccessibility(roomData: RoomData) {
    const { obstacles, dimensions } = roomData;
    
    const doors = obstacles.filter(o => o.type === 'Door');
    const doorWidths = doors.map(d => this.parseSizeToWidth(d.size));
    const minDoorWidth = doors.length > 0 ? Math.min(...doorWidths) : 0.9;

    // Check ADA compliance (US standards)
    const adaDoorWidths = minDoorWidth >= this.MIN_DOOR_WIDTH_ADA;
    const adaTurningRadius = Math.min(dimensions.width, dimensions.length) >= this.MIN_TURNING_RADIUS;
    const adaClearanceHeights = dimensions.height >= 2.03; // 80 inches minimum

    // Check WCAG compliance (general accessibility)
    const wcagDoorWidths = minDoorWidth >= 0.8; // 80cm minimum
    const wcagTurningRadius = Math.min(dimensions.width, dimensions.length) >= 1.2;
    const wcagClearanceHeights = dimensions.height >= 1.95; // minimum comfortable height

    const recommendations: string[] = [];
    if (!adaDoorWidths) {
      recommendations.push(`Door width (${(minDoorWidth * 100).toFixed(0)}cm) below ADA minimum of 81.5cm`);
    }
    if (!adaTurningRadius) {
      recommendations.push(`Room dimensions too small for ADA wheelchair turning radius (152cm required)`);
    }
    if (!wcagClearanceHeights) {
      recommendations.push(`Consider raising ceiling height for better accessibility (minimum 195cm recommended)`);
    }

    let overallWcag: 'compliant' | 'non-compliant' | 'partial' = 'compliant';
    if (!wcagDoorWidths || !wcagTurningRadius || !wcagClearanceHeights) {
      overallWcag = wcagDoorWidths && wcagClearanceHeights ? 'partial' : 'non-compliant';
    }

    let overallAda: 'compliant' | 'non-compliant' | 'partial' = 'compliant';
    if (!adaDoorWidths || !adaTurningRadius || !adaClearanceHeights) {
      overallAda = adaDoorWidths && adaClearanceHeights ? 'partial' : 'non-compliant';
    }

    return {
      wcagCompliance: {
        doorWidths: wcagDoorWidths,
        turningRadius: wcagTurningRadius,
        clearanceHeights: wcagClearanceHeights,
        overall: overallWcag,
      },
      adaCompliance: {
        doorWidths: adaDoorWidths,
        turningRadius: adaTurningRadius,
        clearanceHeights: adaClearanceHeights,
        overall: overallAda,
      },
      recommendations,
    };
  }

  /**
   * Analyze building code compliance
   */
  private analyzeBuildingCode(roomData: RoomData): DesignAnalysis['buildingCode'] {
    const { dimensions, obstacles } = roomData;
    const violations: string[] = [];

    // Egress requirements
    const windows = obstacles.filter(o => o.type === 'Window');
    const doors = obstacles.filter(o => o.type === 'Door');
    
    // Check window egress (minimum 0.38m x 0.38m opening)
    let windowEgress = true;
    windows.forEach(w => {
      const windowArea = this.parseSizeToArea(w.size);
      if (windowArea < 0.145) { // 0.38m x 0.38m minimum
        windowEgress = false;
        violations.push(`Window egress violation: Window opening too small (minimum 0.38m x 0.38m required)`);
      }
    });

    // Check door egress (minimum 0.711m width)
    const doorWidths = doors.map(d => this.parseSizeToWidth(d.size));
    const doorEgress = doorWidths.length > 0 && Math.min(...doorWidths) >= this.MIN_DOOR_WIDTH_EGRESS;
    if (!doorEgress && doorWidths.length > 0) {
      violations.push(`Door egress violation: Minimum door width of 0.711m (28") required for emergency egress`);
    }

    // Ventilation requirements
    const hasWindows = windows.length > 0;
    const naturalVentilation = hasWindows;
    const mechanicalVentilation = !hasWindows; // If no windows, need mechanical
    const ventilationCompliance = naturalVentilation || mechanicalVentilation;

    // Ceiling height requirements
    const ceilingHeightMet = dimensions.height >= this.MIN_CEILING_HEIGHT;
    const ceilingHeightCompliance = ceilingHeightMet;
    if (!ceilingHeightMet) {
      violations.push(`Ceiling height violation: Minimum height of 2.13m (7ft) required`);
    }

    const overallCompliance = doorEgress && ventilationCompliance && ceilingHeightCompliance;

    return {
      egress: {
        windowEgress,
        doorEgress,
        compliance: doorEgress,
      },
      ventilation: {
        naturalVentilation,
        mechanicalVentilation,
        compliance: ventilationCompliance,
      },
      ceilingHeight: {
        minimumMet: ceilingHeightMet,
        actualHeight: dimensions.height,
        compliance: ceilingHeightCompliance,
      },
      overallCompliance,
      violations,
    };
  }

  /**
   * Generate professional design report
   */
  generateProfessionalReport(
    roomData: RoomData,
    projectName: string = 'Interior Design Project'
  ): ProfessionalReport {
    const materialCalculations = this.calculateMaterials(roomData);
    const designAnalysis = this.analyzeDesign(roomData);

    // Generate recommendations
    const recommendations: Array<{
      category: string;
      priority: 'high' | 'medium' | 'low';
      description: string;
      estimatedCost?: number;
    }> = [];

    // High priority: Building code violations
    if (!designAnalysis.buildingCode.overallCompliance) {
      designAnalysis.buildingCode.violations.forEach(violation => {
        recommendations.push({
          category: 'Building Code',
          priority: 'high',
          description: violation,
        });
      });
    }

    // Medium priority: Accessibility
    if (designAnalysis.accessibility.wcagCompliance.overall !== 'compliant') {
      recommendations.push({
        category: 'Accessibility',
        priority: 'medium',
        description: designAnalysis.accessibility.recommendations.join('; '),
      });
    }

    // Low priority: Design improvements
    if (designAnalysis.trafficFlow.bottlenecks.length > 0) {
      recommendations.push({
        category: 'Traffic Flow',
        priority: 'low',
        description: designAnalysis.trafficFlow.bottlenecks[0].recommendation,
      });
    }

    // Measurements breakdown
    const wallMeasurements = roomData.walls.map(wall => ({
      id: wall.id,
      orientation: wall.orientation,
      length: parseFloat(wall.length.toFixed(3)),
      height: roomData.dimensions.height,
      area: parseFloat((wall.length * roomData.dimensions.height).toFixed(2)),
    }));

    const windowMeasurements = roomData.obstacles
      .filter(o => o.type === 'Window')
      .map((w, idx) => {
        const area = this.parseSizeToArea(w.size);
        const [width, height] = this.parseSize(w.size);
        return {
          id: w.id || `window-${idx}`,
          width: parseFloat(width.toFixed(3)),
          height: parseFloat(height.toFixed(3)),
          area: parseFloat(area.toFixed(2)),
        };
      });

    const doorMeasurements = roomData.obstacles
      .filter(o => o.type === 'Door')
      .map((d, idx) => {
        const area = this.parseSizeToArea(d.size);
        const [width, height] = this.parseSize(d.size);
        return {
          id: d.id || `door-${idx}`,
          width: parseFloat(width.toFixed(3)),
          height: parseFloat(height.toFixed(3)),
          area: parseFloat(area.toFixed(2)),
        };
      });

    return {
      roomId: `room-${Date.now()}`,
      projectName,
      date: new Date().toISOString().split('T')[0],
      dimensions: {
        width: parseFloat(roomData.dimensions.width.toFixed(3)),
        length: parseFloat(roomData.dimensions.length.toFixed(3)),
        height: parseFloat(roomData.dimensions.height.toFixed(3)),
        area: parseFloat(roomData.area.toFixed(2)),
        volume: parseFloat((roomData.volume || 0).toFixed(2)),
        accuracy: roomData.dimensions.accuracy,
      },
      materialCalculations,
      designAnalysis,
      recommendations,
      measurements: {
        walls: wallMeasurements,
        windows: windowMeasurements,
        doors: doorMeasurements,
      },
    };
  }

  // Helper methods
  private parseSize(size: string): [number, number] {
    // Parse "1.2m x 1.5m" format
    const match = size.match(/([\d.]+)\s*m?\s*x\s*([\d.]+)\s*m?/i);
    if (match) {
      return [parseFloat(match[1]), parseFloat(match[2])];
    }
    return [1.0, 2.0]; // defaults
  }

  private parseSizeToArea(size: string): number {
    const [width, height] = this.parseSize(size);
    return width * height;
  }

  private parseSizeToWidth(size: string): number {
    const [width] = this.parseSize(size);
    return width;
  }

  private rateClearance(actual: number, minimum: number): 'excellent' | 'good' | 'adequate' | 'poor' {
    if (actual >= minimum * 1.2) return 'excellent';
    if (actual >= minimum * 1.1) return 'good';
    if (actual >= minimum) return 'adequate';
    return 'poor';
  }

  private calculateOverallRating(values: number[], thresholds: number[]): 'excellent' | 'good' | 'adequate' | 'poor' {
    let allMet = true;
    let allExceeded = true;

    for (let i = 0; i < values.length && i < thresholds.length; i++) {
      if (values[i] < thresholds[i]) {
        allMet = false;
        allExceeded = false;
      } else if (values[i] < thresholds[i] * 1.1) {
        allExceeded = false;
      }
    }

    if (allExceeded) return 'excellent';
    if (allMet) return 'good';
    return allMet ? 'adequate' : 'poor';
  }
}

// Export singleton instance
export const professionalDesignService = new ProfessionalDesignService();

