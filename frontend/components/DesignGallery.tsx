/**
 * Design Gallery Component
 * Displays a grid of generated design images
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image, ActivityIndicator, FlatList, Dimensions } from 'react-native';
import { colors, spacing, radii, shadows } from '@/components/ui/theme';
import { AppText } from '@/components/ui/Text';

export interface DesignImage {
  id: string;
  url: string;
  prompt?: string;
  style?: string;
  roomType?: string;
  generatedAt?: number;
}

interface DesignGalleryProps {
  images: DesignImage[];
  onImagePress?: (image: DesignImage) => void;
  loading?: boolean;
  emptyMessage?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_SIZE = (SCREEN_WIDTH - spacing.xl * 2 - spacing.md) / 2;

export function DesignGallery({
  images,
  onImagePress,
  loading = false,
  emptyMessage = 'No designs generated yet',
}: DesignGalleryProps) {
  const renderImage = ({ item }: { item: DesignImage }) => (
    <TouchableOpacity
      style={styles.imageContainer}
      onPress={() => onImagePress?.(item)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: item.url }}
        style={styles.image}
        resizeMode="cover"
      />
      {(item.style || item.roomType) && (
        <View style={styles.imageOverlay}>
          <AppText variant="caption" style={styles.imageLabel} numberOfLines={1}>
            {[item.style, item.roomType].filter(Boolean).join(' ')}
          </AppText>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading && images.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <AppText variant="body" color="textMuted" style={styles.loadingText}>
          Generating designs...
        </AppText>
      </View>
    );
  }

  if (images.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <AppText variant="body" color="textMuted" style={styles.emptyText}>
          {emptyMessage}
        </AppText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      )}
      <FlatList
        data={images}
        renderItem={renderImage}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        scrollEnabled={!loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: spacing.md,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  imageContainer: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSecondary,
    ...shadows.sm,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  imageLabel: {
    color: '#FFFFFF',
    fontSize: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  loadingText: {
    marginTop: spacing.md,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyText: {
    textAlign: 'center',
  },
});
