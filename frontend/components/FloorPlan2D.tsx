import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Text as SvgText, Path, G, Line, Circle, Defs, Filter, FeDropShadow } from 'react-native-svg';

export interface RoomDimensions {
  width: number;
  height: number;
  depth: number;
}

export interface FurnitureItem {
  name: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  rotation: number;
  color: string;
}

interface FloorPlan2DProps {
  roomDimensions: RoomDimensions;
  furniture: FurnitureItem[];
  obstacles: string[];
}

// 2.5D Realistic Colors
const ROOM_FLOOR = '#e6d5c3'; // Warm wood/carpet tone
const ROOM_WALL = '#333333';
const WALL_THICKNESS = "8";

// Furniture Material Colors
const COLOR_BED_FRAME = '#8b5a2b';
const COLOR_BED_SHEET = '#ffffff';
const COLOR_PILLOW = '#cbd5e1';
const COLOR_SOFA = '#475569';
const COLOR_TABLE = '#a0522d';
const COLOR_CHAIR = '#d4a373';
const COLOR_PLANT = '#22c55e';
const COLOR_GENERIC = '#e2e8f0';

const CAD_TEXT = '#111111';
const CAD_DIMENSION = '#6b21a8';
const CAD_GRID = '#f8fafc';

export default function FloorPlan2D({ roomDimensions, furniture, obstacles }: FloorPlan2DProps) {
  // Screen width minus padding
  const containerWidth = Dimensions.get('window').width - 32;
  
  // Padding inside the SVG for dimension lines
  const PADDING = 40; 
  
  const roomWidthMeters = roomDimensions.width || 5;
  const roomDepthMeters = roomDimensions.depth || 5;
  
  // Calculate scale to fit room into container (accounting for padding)
  const drawAreaWidth = containerWidth - (PADDING * 2);
  const scale = drawAreaWidth / Math.max(roomWidthMeters, roomDepthMeters);
  
  const roomSvgWidth = roomWidthMeters * scale;
  const roomSvgHeight = roomDepthMeters * scale;
  
  const totalSvgWidth = roomSvgWidth + (PADDING * 2);
  const totalSvgHeight = roomSvgHeight + (PADDING * 2);

  return (
    <View style={styles.container}>
      <Svg width={totalSvgWidth} height={totalSvgHeight}>
        
        {/* Draw Grid (optional subtle graph paper) */}
        <G>
           {[...Array(Math.ceil(roomWidthMeters * 2))].map((_, i) => (
             <Line
               key={`gx-${i}`}
               x1={PADDING + (i * 0.5 * scale)}
               y1={PADDING}
               x2={PADDING + (i * 0.5 * scale)}
               y2={PADDING + roomSvgHeight}
               stroke={CAD_GRID}
               strokeWidth="1"
             />
           ))}
           {[...Array(Math.ceil(roomDepthMeters * 2))].map((_, i) => (
             <Line
               key={`gy-${i}`}
               x1={PADDING}
               y1={PADDING + (i * 0.5 * scale)}
               x2={PADDING + roomSvgWidth}
               y2={PADDING + (i * 0.5 * scale)}
               stroke={CAD_GRID}
               strokeWidth="1"
             />
           ))}
        </G>

        {/* Top Dimension Line */}
        <Line 
          x1={PADDING} y1={PADDING - 20} 
          x2={PADDING + roomSvgWidth} y2={PADDING - 20} 
          stroke={CAD_DIMENSION} strokeWidth="1" 
        />
        <Line x1={PADDING} y1={PADDING - 25} x2={PADDING} y2={PADDING - 15} stroke={CAD_DIMENSION} strokeWidth="1" />
        <Line x1={PADDING + roomSvgWidth} y1={PADDING - 25} x2={PADDING + roomSvgWidth} y2={PADDING - 15} stroke={CAD_DIMENSION} strokeWidth="1" />
        <SvgText x={PADDING + (roomSvgWidth / 2)} y={PADDING - 25} fill={CAD_DIMENSION} fontSize="12" textAnchor="middle">{roomWidthMeters}m</SvgText>

        {/* Left Dimension Line */}
        <Line 
          x1={PADDING - 20} y1={PADDING} 
          x2={PADDING - 20} y2={PADDING + roomSvgHeight} 
          stroke={CAD_DIMENSION} strokeWidth="1" 
        />
        <Line x1={PADDING - 25} y1={PADDING} x2={PADDING - 15} y2={PADDING} stroke={CAD_DIMENSION} strokeWidth="1" />
        <Line x1={PADDING - 25} y1={PADDING + roomSvgHeight} x2={PADDING - 15} y2={PADDING + roomSvgHeight} stroke={CAD_DIMENSION} strokeWidth="1" />
        
        <G rotation="-90" origin={`${PADDING - 25}, ${PADDING + (roomSvgHeight / 2)}`}>
          <SvgText x={PADDING - 25} y={PADDING + (roomSvgHeight / 2) - 5} fill={CAD_DIMENSION} fontSize="12" textAnchor="middle">{roomDepthMeters}m</SvgText>
        </G>

        <Defs>
          <Filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
            <FeDropShadow dx="2" dy="3" stdDeviation="3" floodOpacity="0.3" floodColor="#000" />
          </Filter>
          <Filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <FeDropShadow dx="1" dy="1" stdDeviation="2" floodOpacity="0.2" floodColor="#000" />
          </Filter>
        </Defs>

        {/* Realistic Floor Background */}
        <Rect
          x={PADDING}
          y={PADDING}
          width={roomSvgWidth}
          height={roomSvgHeight}
          fill={ROOM_FLOOR}
        />

        {/* Thick 3D Room Boundary Walls */}
        <Rect
          x={PADDING}
          y={PADDING}
          width={roomSvgWidth}
          height={roomSvgHeight}
          fill="transparent"
          stroke={ROOM_WALL}
          strokeWidth={WALL_THICKNESS}
        />

        {/* Obstacles (Architectural Symbols) */}
        {obstacles.map((obs, idx) => {
          const isDoor = obs.toLowerCase().includes('door');
          const isWindow = obs.toLowerCase().includes('window');
          
          let x = PADDING + ((idx * 80) % (roomSvgWidth - 40));
          
          if (isDoor) {
            // Draw an architectural door arc
            return (
              <G key={`obs-${idx}`} x={x} y={PADDING}>
                {/* Wall cut out */}
                <Line x1="0" y1="0" x2="30" y2="0" stroke={ROOM_FLOOR} strokeWidth={WALL_THICKNESS} />
                {/* Door open line */}
                <Line x1="0" y1="0" x2="0" y2="30" stroke={ROOM_WALL} strokeWidth="3" />
                {/* Door swing arc */}
                <Path d="M 0 30 A 30 30 0 0 1 30 0" stroke={ROOM_WALL} strokeWidth="1" fill="none" strokeDasharray="3 3" />
              </G>
            );
          } else if (isWindow) {
            // Draw an architectural window
            return (
              <G key={`obs-${idx}`} x={x} y={PADDING + roomSvgHeight}>
                <Line x1="0" y1="0" x2="40" y2="0" stroke="#bae6fd" strokeWidth={WALL_THICKNESS} opacity="0.8" />
                <Rect x="0" y="-3" width="40" height="6" fill="transparent" stroke={ROOM_WALL} strokeWidth="1" />
                <Line x1="0" y1="0" x2="40" y2="0" stroke={ROOM_WALL} strokeWidth="2" />
              </G>
            );
          }
          return null;
        })}

        {/* Furniture Items (Minimalist Outlines) */}
        {furniture.map((item, idx) => {
          const itemWidth = item.width * scale;
          const itemHeight = item.depth * scale;
          const itemX = PADDING + (item.x * scale);
          const itemY = PADDING + (item.y * scale);
          
          const centerX = itemX + itemWidth / 2;
          const centerY = itemY + itemHeight / 2;
          
          const renderFurnitureStencil = () => {
            const name = item.name.toLowerCase();
            
            let baseBox = null;
            let stencilDetails = null;

            if (name.includes('bed')) {
              // Realistic Bed with Sheets and Pillows
              const pillowHeight = itemHeight * 0.2;
              const pillowWidth = itemWidth * 0.4;
              baseBox = <Rect x={itemX} y={itemY} width={itemWidth} height={itemHeight} fill={COLOR_BED_FRAME} rx="4" filter="url(#dropShadow)" />;
              stencilDetails = (
                <G>
                  {/* Mattress / Sheet */}
                  <Rect x={itemX + 2} y={itemY + 2} width={itemWidth - 4} height={itemHeight - 4} fill={COLOR_BED_SHEET} rx="2" />
                  {/* Pillows */}
                  <Rect x={itemX + itemWidth * 0.05} y={itemY + 5} width={pillowWidth} height={pillowHeight} fill={COLOR_PILLOW} rx="4" filter="url(#softShadow)" />
                  <Rect x={itemX + itemWidth * 0.55} y={itemY + 5} width={pillowWidth} height={pillowHeight} fill={COLOR_PILLOW} rx="4" filter="url(#softShadow)" />
                  {/* Blanket fold */}
                  <Line x1={itemX + 2} y1={itemY + Math.max(pillowHeight + 10, 15)} x2={itemX + itemWidth - 2} y2={itemY + Math.max(pillowHeight + 10, 15)} stroke="#e2e8f0" strokeWidth="2" />
                </G>
              );
            } else if (name.includes('sofa') || name.includes('couch')) {
              // Realistic Sofa
              const backrestHeight = itemHeight * 0.3;
              baseBox = <Rect x={itemX} y={itemY} width={itemWidth} height={itemHeight} fill={COLOR_SOFA} rx="4" filter="url(#dropShadow)" />;
              stencilDetails = (
                <G>
                  {/* Backrest drop shadow for depth */}
                  <Rect x={itemX} y={itemY} width={itemWidth} height={backrestHeight} fill="rgba(0,0,0,0.15)" rx="4" />
                  {/* Armrests */}
                  <Rect x={itemX} y={itemY + backrestHeight} width={itemWidth * 0.15} height={itemHeight - backrestHeight} fill="rgba(255,255,255,0.1)" rx="2" />
                  <Rect x={itemX + itemWidth * 0.85} y={itemY + backrestHeight} width={itemWidth * 0.15} height={itemHeight - backrestHeight} fill="rgba(255,255,255,0.1)" rx="2" />
                  {/* Cushion split */}
                  <Line x1={itemX + itemWidth * 0.5} y1={itemY + backrestHeight} x2={itemX + itemWidth * 0.5} y2={itemY + itemHeight - 2} stroke="rgba(0,0,0,0.3)" strokeWidth="2" />
                </G>
              );
            } else if (name.includes('table') || name.includes('dining')) {
              // Realistic Wood Table with Chairs tucked under
              const chairSize = 12;
              stencilDetails = (
                <G>
                  {/* Chairs (drawn first so they look tucked under) */}
                  <Rect x={itemX + itemWidth * 0.3 - chairSize/2} y={itemY - chairSize/2} width={chairSize} height={chairSize} fill={COLOR_CHAIR} rx="4" filter="url(#softShadow)" />
                  <Rect x={itemX + itemWidth * 0.7 - chairSize/2} y={itemY - chairSize/2} width={chairSize} height={chairSize} fill={COLOR_CHAIR} rx="4" filter="url(#softShadow)" />
                  <Rect x={itemX + itemWidth * 0.3 - chairSize/2} y={itemY + itemHeight - chairSize/2} width={chairSize} height={chairSize} fill={COLOR_CHAIR} rx="4" filter="url(#softShadow)" />
                  <Rect x={itemX + itemWidth * 0.7 - chairSize/2} y={itemY + itemHeight - chairSize/2} width={chairSize} height={chairSize} fill={COLOR_CHAIR} rx="4" filter="url(#softShadow)" />
                  {/* Table surface (drawn over chairs) */}
                  <Rect x={itemX} y={itemY} width={itemWidth} height={itemHeight} fill={COLOR_TABLE} rx="2" filter="url(#dropShadow)" />
                  {/* Inner bevel line for realism */}
                  <Rect x={itemX + 2} y={itemY + 2} width={itemWidth - 4} height={itemHeight - 4} fill="transparent" stroke="rgba(255,255,255,0.2)" strokeWidth="1" rx="1" />
                </G>
              );
            } else if (name.includes('tv') || name.includes('cabinet') || name.includes('wardrobe')) {
              // Dark elegant cabinet
              baseBox = <Rect x={itemX} y={itemY} width={itemWidth} height={itemHeight} fill="#1e293b" rx="2" filter="url(#dropShadow)" />;
              stencilDetails = (
                <G>
                  <Line x1={itemX + 2} y1={itemY + 2} x2={itemX + itemWidth - 2} y2={itemY + itemHeight - 2} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                  <Line x1={itemX + itemWidth - 2} y1={itemY + 2} x2={itemX + 2} y2={itemY + itemHeight - 2} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                </G>
              );
            } else if (name.includes('plant') || name.includes('tree')) {
              // Vibrant layered plant
              return (
                <G>
                  <Circle cx={centerX} cy={centerY} r={Math.min(itemWidth, itemHeight)/2} fill="#14532d" filter="url(#dropShadow)" />
                  <Circle cx={centerX} cy={centerY} r={Math.min(itemWidth, itemHeight)/2.5} fill={COLOR_PLANT} />
                  <Circle cx={centerX} cy={centerY} r={Math.min(itemWidth, itemHeight)/4} fill="#4ade80" />
                </G>
              );
            } else {
              // Generic Box (rug, miscellaneous)
              baseBox = <Rect x={itemX} y={itemY} width={itemWidth} height={itemHeight} fill={COLOR_GENERIC} rx="2" filter="url(#softShadow)" />;
              stencilDetails = (
                <Rect x={itemX + 2} y={itemY + 2} width={itemWidth - 4} height={itemHeight - 4} fill="transparent" stroke="rgba(0,0,0,0.1)" strokeWidth="1" rx="2" />
              );
            }

            return (
              <G>
                {baseBox}
                {stencilDetails}
              </G>
            );
          };

          const shouldShowText = itemWidth >= 25 && itemHeight >= 15 && !item.name.toLowerCase().includes('chair');
          // Scale font down if the box is small
          const fontSize = Math.max(5, Math.min(9, itemWidth / 4));

          return (
            <G key={`furn-${idx}`} rotation={item.rotation || 0} origin={`${centerX}, ${centerY}`}>
              {renderFurnitureStencil()}
              {shouldShowText && (
                <SvgText
                  x={centerX}
                  y={centerY}
                  fill={CAD_TEXT}
                  fontSize={fontSize}
                  fontWeight="bold"
                  textAnchor="middle"
                  alignmentBaseline="middle"
                >
                  {item.name.toUpperCase()}
                </SvgText>
              )}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    alignSelf: 'center',
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
});
