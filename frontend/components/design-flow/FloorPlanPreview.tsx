import React, { useMemo, useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';
import { designItemColor } from '@/utils/designItemColors';
import type { DesignLayoutItem } from '@/types/design-flow';

interface FloorPlanPreviewProps {
  widthM: number;
  lengthM: number;
  items: DesignLayoutItem[];
  maxHeight?: number;
}

type SymbolKind = 'sofa' | 'bed' | 'chair' | 'table' | 'rug' | 'other';

/** Space around the room for the dimension labels (px). */
const LABEL_PAD = 18;
/** Width used until the container has been measured (px). */
const FALLBACK_WIDTH = 280;
const GRID_STEP_M = 0.5;

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return `rgba(37, 99, 235, ${alpha})`;
  const n = parseInt(raw, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function symbolKind(item: DesignLayoutItem): SymbolKind {
  const text = `${item.role || ''} ${item.category || ''} ${item.displayName || ''}`.toLowerCase();
  if (/\brug\b/.test(text)) return 'rug';
  if (/sofa|couch|sectional|loveseat/.test(text)) return 'sofa';
  if (/\bbed\b/.test(text)) return 'bed';
  if (/chair|stool|seat/.test(text)) return 'chair';
  if (/table|desk/.test(text)) return 'table';
  return 'other';
}

function formatMeters(value: number): string {
  return `${value.toFixed(value < 10 ? 1 : 0)} m`;
}

/** Short label that fits a small footprint: "Bahamas Sofa" → "Bahamas". */
function shortName(name: string, maxChars: number): string {
  if (name.length <= maxChars) return name;
  const first = name.split(/\s+/)[0] || name;
  return first.length <= maxChars ? first : `${first.slice(0, Math.max(1, maxChars - 1))}…`;
}

/**
 * Top-down symbol in local pixels: (0,0)–(w,d), back edge at the top, facing down (+z).
 */
function FurnitureSymbol({ kind, w, d, color, line }: {
  kind: SymbolKind;
  w: number;
  d: number;
  color: string;
  line: number;
}) {
  const fill = hexToRgba(color, 0.28);
  const solid = hexToRgba(color, 0.5);
  const radius = Math.min(w, d) * 0.12;

  if (kind === 'rug') {
    return (
      <Rect x={0} y={0} width={w} height={d} rx={radius} fill={hexToRgba(color, 0.25)}
        stroke={color} strokeWidth={line} strokeDasharray={`${line * 3},${line * 2}`} />
    );
  }

  if (kind === 'sofa') {
    const back = d * 0.24;
    const arm = Math.min(w * 0.12, d * 0.3);
    const seats = w / d > 1.6 ? 3 : 2;
    const seatW = (w - arm * 2) / seats;
    return (
      <G>
        <Rect x={0} y={0} width={w} height={d} rx={radius} fill={fill} stroke={color} strokeWidth={line} />
        <Rect x={0} y={0} width={w} height={back} rx={radius} fill={solid} stroke={color} strokeWidth={line} />
        <Rect x={0} y={0} width={arm} height={d} rx={radius} fill={solid} stroke={color} strokeWidth={line} />
        <Rect x={w - arm} y={0} width={arm} height={d} rx={radius} fill={solid} stroke={color} strokeWidth={line} />
        {Array.from({ length: seats - 1 }, (_, i) => (
          <Line key={i} x1={arm + seatW * (i + 1)} y1={back} x2={arm + seatW * (i + 1)} y2={d}
            stroke={color} strokeWidth={line * 0.8} />
        ))}
      </G>
    );
  }

  if (kind === 'bed') {
    const head = d * 0.07;
    const pillowY = head + d * 0.03;
    const pillowH = d * 0.14;
    const blanketY = pillowY + pillowH + d * 0.06;
    return (
      <G>
        <Rect x={0} y={0} width={w} height={d} rx={radius * 0.5} fill={fill} stroke={color} strokeWidth={line} />
        <Rect x={0} y={0} width={w} height={head} fill={solid} stroke={color} strokeWidth={line} />
        <Rect x={w * 0.07} y={pillowY} width={w * 0.4} height={pillowH} rx={pillowH * 0.3}
          fill="rgba(255,255,255,0.7)" stroke={color} strokeWidth={line * 0.8} />
        <Rect x={w * 0.53} y={pillowY} width={w * 0.4} height={pillowH} rx={pillowH * 0.3}
          fill="rgba(255,255,255,0.7)" stroke={color} strokeWidth={line * 0.8} />
        <Rect x={0} y={blanketY} width={w} height={d - blanketY} fill={solid} stroke={color} strokeWidth={line} />
      </G>
    );
  }

  if (kind === 'chair') {
    return (
      <G>
        <Rect x={w * 0.1} y={d * 0.15} width={w * 0.8} height={d * 0.8} rx={radius} fill={fill}
          stroke={color} strokeWidth={line} />
        <Rect x={w * 0.05} y={0} width={w * 0.9} height={d * 0.2} rx={radius * 0.6} fill={solid}
          stroke={color} strokeWidth={line} />
      </G>
    );
  }

  if (kind === 'table') {
    const inset = Math.min(w, d) * 0.1;
    return (
      <G>
        <Rect x={0} y={0} width={w} height={d} rx={radius * 0.5} fill={fill} stroke={color} strokeWidth={line} />
        <Rect x={inset} y={inset} width={w - inset * 2} height={d - inset * 2} rx={radius * 0.4}
          fill="none" stroke={color} strokeWidth={line * 0.6} />
      </G>
    );
  }

  return <Rect x={0} y={0} width={w} height={d} rx={radius} fill={fill} stroke={color} strokeWidth={line} />;
}

/**
 * Top view of a room layout: floor grid, walls, dimensions and furniture symbols drawn
 * to scale, sized to the available width.
 */
export function FloorPlanPreview({
  widthM,
  lengthM,
  items,
  maxHeight = 180,
}: FloorPlanPreviewProps) {
  const { colors, isDark } = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const safeW = widthM > 0 ? widthM : 4;
  const safeL = lengthM > 0 ? lengthM : 5;

  const plan = useMemo(() => {
    const availableW = Math.max(120, (containerWidth || FALLBACK_WIDTH) - LABEL_PAD * 2);
    const availableH = Math.max(80, maxHeight - LABEL_PAD * 2);
    const scale = Math.min(availableW / safeW, availableH / safeL);
    const roomW = safeW * scale;
    const roomH = safeL * scale;
    return {
      scale,
      roomW,
      roomH,
      svgW: roomW + LABEL_PAD * 2,
      svgH: roomH + LABEL_PAD * 2,
      wall: Math.max(3, Math.min(8, scale * 0.1)),
    };
  }, [containerWidth, maxHeight, safeL, safeW]);

  const onLayout = (event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    if (width > 0 && width !== containerWidth) setContainerWidth(width);
  };

  const floor = isDark ? '#2B2823' : '#F4EEE4';
  const grid = isDark ? '#38332C' : '#E6DDCF';
  const wallColor = colors.textPrimary;
  const solidCount = items.filter((item) => symbolKind(item) !== 'rug').length;
  const ordered = [...items].sort((a, b) => Number(symbolKind(b) === 'rug') - Number(symbolKind(a) === 'rug'));

  const gridLines: React.ReactNode[] = [];
  for (let x = GRID_STEP_M; x < safeW - 0.01; x += GRID_STEP_M) {
    gridLines.push(<Line key={`gx${x}`} x1={x * plan.scale} y1={0} x2={x * plan.scale} y2={plan.roomH} stroke={grid} strokeWidth={1} />);
  }
  for (let z = GRID_STEP_M; z < safeL - 0.01; z += GRID_STEP_M) {
    gridLines.push(<Line key={`gz${z}`} x1={0} y1={z * plan.scale} x2={plan.roomW} y2={z * plan.scale} stroke={grid} strokeWidth={1} />);
  }

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Svg
        width={plan.svgW}
        height={plan.svgH}
        accessibilityLabel={`Floor plan ${safeW.toFixed(1)} by ${safeL.toFixed(1)} meters with ${solidCount} pieces`}
      >
        <SvgText x={LABEL_PAD + plan.roomW / 2} y={LABEL_PAD - 6} fontSize={10} fill={colors.textMuted}
          textAnchor="middle">
          {formatMeters(safeW)}
        </SvgText>
        <SvgText x={LABEL_PAD + plan.roomW + 6} y={LABEL_PAD + plan.roomH / 2} fontSize={10} fill={colors.textMuted}
          textAnchor="middle" transform={`rotate(90, ${LABEL_PAD + plan.roomW + 6}, ${LABEL_PAD + plan.roomH / 2})`}>
          {formatMeters(safeL)}
        </SvgText>

        <G transform={`translate(${LABEL_PAD}, ${LABEL_PAD})`}>
          <Rect x={0} y={0} width={plan.roomW} height={plan.roomH} fill={floor} />
          {gridLines}

          {ordered.map((item, index) => {
            const kind = symbolKind(item);
            const w = item.width * plan.scale;
            const d = item.depth * plan.scale;
            const rotated = item.rotationY % 180 !== 0;
            const footW = rotated ? d : w;
            const footD = rotated ? w : d;
            const cx = item.localPosition.x * plan.scale + footW / 2;
            const cz = item.localPosition.z * plan.scale + footD / 2;
            const color = designItemColor(items.indexOf(item), item.category, item.role);
            // Rotation 0 faces +z (down the plan); SVG rotates clockwise, so negate.
            return (
              <G key={item.instanceId || index}
                transform={`translate(${cx}, ${cz}) rotate(${-item.rotationY}) translate(${-w / 2}, ${-d / 2})`}>
                <FurnitureSymbol kind={kind} w={w} d={d} color={color} line={1.2} />
              </G>
            );
          })}

          {ordered.map((item, index) => {
            if (symbolKind(item) === 'rug') return null;
            const rotated = item.rotationY % 180 !== 0;
            const footW = (rotated ? item.depth : item.width) * plan.scale;
            const footD = (rotated ? item.width : item.depth) * plan.scale;
            if (footW < 34 || footD < 16) return null;
            const fontSize = Math.max(7, Math.min(11, Math.min(footW, footD) * 0.2));
            const label = shortName(item.displayName, Math.floor(footW / (fontSize * 0.6)));
            return (
              <SvgText key={`label-${item.instanceId || index}`}
                x={item.localPosition.x * plan.scale + footW / 2}
                y={item.localPosition.z * plan.scale + footD / 2 + fontSize * 0.35}
                fontSize={fontSize} fontWeight="600" fill={colors.textPrimary} textAnchor="middle">
                {label}
              </SvgText>
            );
          })}

          <Rect x={0} y={0} width={plan.roomW} height={plan.roomH} fill="none" stroke={wallColor}
            strokeWidth={plan.wall} />

          {solidCount === 0 ? (
            <SvgText x={plan.roomW / 2} y={plan.roomH / 2 + 4} fontSize={11} fill={colors.textMuted}
              textAnchor="middle">
              No furniture fits this room
            </SvgText>
          ) : null}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
});
