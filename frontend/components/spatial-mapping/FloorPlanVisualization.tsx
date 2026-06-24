/**
 * Floor Plan Visualization Component
 * 2D visualization of room layout with obstacles
 */

import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import type { RoomData } from '@/types/spatial-mapping';
import { OBSTACLE_COLORS } from '@/config/spatialMapping.config';

interface FloorPlanVisualizationProps {
  roomData: RoomData;
  useMetric: boolean;
}

export function FloorPlanVisualization({ roomData, useMetric }: FloorPlanVisualizationProps) {
  const { width: screenWidth } = useWindowDimensions();
  const containerWidth = screenWidth - 80;
  const { width, length } = roomData.dimensions;
  
  // Calculate scale to fit screen
  const scale = Math.min((containerWidth * 0.9) / Math.max(width, length), 100);
  const displayWidth = width * scale;
  const displayLength = length * scale;

  return (
    <View style={styles.container}>
      <View style={[styles.floorPlan, { width: displayWidth, height: displayLength }]}>
        {/* Walls */}
        <View style={[styles.wall, styles.wallTop, { width: displayWidth, height: 3 }]} />
        <View style={[styles.wall, styles.wallBottom, { width: displayWidth, height: 3, bottom: 0 }]} />
        <View style={[styles.wall, styles.wallLeft, { width: 3, height: displayLength }]} />
        <View style={[styles.wall, styles.wallRight, { width: 3, height: displayLength, right: 0 }]} />
        
        {/* Obstacles */}
        {roomData.obstacles.map((obstacle, idx) => {
          const obstacleX = (displayWidth / 4) + (idx % 2) * (displayWidth / 2);
          const obstacleY = (displayLength / 4) + Math.floor(idx / 2) * (displayLength / 2);
          const color = OBSTACLE_COLORS[obstacle.type] || OBSTACLE_COLORS.default;
          
          return (
            <View
              key={obstacle.id}
              style={[
                styles.obstacle,
                {
                  left: obstacleX - 8,
                  top: obstacleY - 8,
                  backgroundColor: color,
                },
              ]}
            />
          );
        })}
      </View>
      
      <Text style={styles.label}>
        {useMetric 
          ? `${width.toFixed(1)}m × ${length.toFixed(1)}m` 
          : `${(width * 3.28084).toFixed(1)}ft × ${(length * 3.28084).toFixed(1)}ft`}
      </Text>
      
      <View style={styles.legend}>
        <LegendItem color="#87CEEB" label="Window" />
        <LegendItem color="#8B4513" label="Door" />
        <LegendItem color="#FF6B6B" label="Other" />
      </View>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendColor, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
  },
  floorPlan: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#007AFF',
    position: 'relative',
    minHeight: 150,
    marginBottom: 12,
  },
  wall: {
    position: 'absolute',
    backgroundColor: '#007AFF',
  },
  wallTop: {
    top: 0,
    left: 0,
  },
  wallBottom: {
    bottom: 0,
    left: 0,
  },
  wallLeft: {
    left: 0,
    top: 0,
  },
  wallRight: {
    right: 0,
    top: 0,
  },
  obstacle: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  label: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 8,
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CCC',
  },
  legendText: {
    fontSize: 11,
    color: '#666',
  },
});

