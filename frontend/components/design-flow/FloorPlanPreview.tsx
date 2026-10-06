import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from '@/components/ui/Text';
import { radii } from '@/components/ui/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { designItemColor } from '@/utils/designItemColors';
import type { DesignLayoutItem } from '@/types/design-flow';

interface FloorPlanPreviewProps {
  widthM: number;
  lengthM: number;
  items: DesignLayoutItem[];
  maxHeight?: number;
}

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return `rgba(37, 99, 235, ${alpha})`;
  const n = parseInt(raw, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function FloorPlanPreview({
  widthM,
  lengthM,
  items,
  maxHeight = 180,
}: FloorPlanPreviewProps) {
  const { colors } = useTheme();
  const safeW = widthM > 0 ? widthM : 4;
  const safeL = lengthM > 0 ? lengthM : 5;

  const layout = useMemo(() => {
    const aspect = safeW / safeL;
    const height = maxHeight;
    const width = Math.min(280, Math.max(140, height * aspect));
    return { width, height };
  }, [maxHeight, safeL, safeW]);

  return (
    <View
      style={[
        styles.room,
        {
          width: layout.width,
          height: layout.height,
          backgroundColor: colors.surfaceSecondary,
          borderColor: colors.border,
        },
      ]}
      accessibilityLabel={`Floor plan ${safeW.toFixed(1)} by ${safeL.toFixed(1)} meters`}
    >
      {items.map((item, index) => {
        const rotated = item.rotationY % 180 !== 0;
        const itemW = rotated ? item.depth : item.width;
        const itemD = rotated ? item.width : item.depth;
        const left = (item.localPosition.x / safeW) * layout.width;
        const top = (item.localPosition.z / safeL) * layout.height;
        const boxW = Math.max(8, (itemW / safeW) * layout.width);
        const boxH = Math.max(8, (itemD / safeL) * layout.height);
        const isRug = item.role === 'rug';
        const fill = designItemColor(index, item.category, item.role);
        return (
          <View
            key={item.instanceId}
            style={[
              styles.item,
              {
                left,
                top,
                width: boxW,
                height: boxH,
                backgroundColor: hexToRgba(fill, isRug ? 0.18 : 0.35),
                borderColor: fill,
                borderStyle: isRug ? 'dashed' : 'solid',
              },
            ]}
          >
            {isRug ? null : (
              <AppText
                variant="caption"
                numberOfLines={1}
                style={[styles.itemLabel, { color: colors.textPrimary }]}
              >
                {item.displayName}
              </AppText>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  room: {
    borderWidth: 1,
    borderRadius: radii.sm,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  item: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 2,
    justifyContent: 'center',
  },
  itemLabel: {
    fontSize: 8,
    lineHeight: 10,
  },
});
