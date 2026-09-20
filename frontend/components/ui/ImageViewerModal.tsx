/**
 * Full-screen image preview with Save to Gallery + Share.
 */

import React, { useCallback, useState } from 'react';
import {
  Modal,
  View,
  Image,
  StyleSheet,
  Pressable,
  StatusBar as RNStatusBar,
  Platform,
  Dimensions,
  Share,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { AppText } from '@/components/ui/Text';
import { spacing, radii } from '@/components/ui/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface ImageViewerModalProps {
  visible: boolean;
  uri: string | null;
  title?: string | null;
  subtitle?: string | null;
  onClose: () => void;
}

function safeFileName(title?: string | null): string {
  const base = (title || `Maharlika_AR_${Date.now()}`)
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80);
  return base.toLowerCase().endsWith('.png') ||
    base.toLowerCase().endsWith('.jpg') ||
    base.toLowerCase().endsWith('.jpeg')
    ? base
    : `${base}.jpg`;
}

async function resolveLocalFileUri(uri: string, fileName: string): Promise<string> {
  if (uri.startsWith('file://')) {
    return uri;
  }

  const dest = `${FileSystem.cacheDirectory ?? ''}${fileName}`;

  if (uri.startsWith('data:image/')) {
    const base64 = uri.replace(/^data:image\/\w+;base64,/, '');
    await FileSystem.writeAsStringAsync(dest, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return dest.startsWith('file://') ? dest : `file://${dest}`;
  }

  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    const downloaded = await FileSystem.downloadAsync(uri, dest);
    return downloaded.uri;
  }

  // Relative / bare path
  return uri.startsWith('/') ? `file://${uri}` : uri;
}

export function ImageViewerModal({
  visible,
  uri,
  title,
  subtitle,
  onClose,
}: ImageViewerModalProps) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const showStatus = useCallback((message: string) => {
    setStatus(message);
    setTimeout(() => setStatus(null), 2600);
  }, []);

  const handleSave = useCallback(async () => {
    if (!uri || busy) return;
    setBusy('save');
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        showStatus('Allow photo access to save this image');
        return;
      }

      const localUri = await resolveLocalFileUri(uri, safeFileName(title));
      await MediaLibrary.createAssetAsync(localUri);
      showStatus('Saved to your gallery');
    } catch (error) {
      console.warn('[ImageViewer] Save failed:', error instanceof Error ? error.message : error);
      showStatus('Couldn’t save image');
    } finally {
      setBusy(null);
    }
  }, [busy, showStatus, title, uri]);

  const handleShare = useCallback(async () => {
    if (!uri || busy) return;
    setBusy('share');
    try {
      const localUri = await resolveLocalFileUri(uri, safeFileName(title));
      const result = await Share.share(
        Platform.OS === 'ios'
          ? {
              url: localUri,
              message: title ? `Maharlika Furniture — ${title}` : 'Maharlika Furniture',
            }
          : {
              // Android attaches best when the path is in `message` for many share targets;
              // `url` is also passed for apps that accept it.
              title: title || 'Maharlika Furniture',
              message: localUri,
              url: localUri,
            }
      );

      if (result.action === Share.sharedAction) {
        showStatus('Shared');
      }
    } catch (error) {
      console.warn('[ImageViewer] Share failed:', error instanceof Error ? error.message : error);
      showStatus('Couldn’t open share sheet');
    } finally {
      setBusy(null);
    }
  }, [busy, showStatus, title, uri]);

  if (!uri) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {Platform.OS === 'android' ? (
          <RNStatusBar backgroundColor="#000000" barStyle="light-content" />
        ) : null}

        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          accessibilityLabel="Close preview"
        />

        <View
          style={[
            styles.topBar,
            { paddingTop: Math.max(insets.top, spacing.md), paddingHorizontal: spacing.lg },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.topCopy}>
            {title ? (
              <AppText variant="subtitle" weight="600" numberOfLines={1} style={styles.title}>
                {title}
              </AppText>
            ) : null}
            {subtitle ? (
              <AppText variant="caption" numberOfLines={1} style={styles.subtitle}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.imageWrap} pointerEvents="box-none">
          <Image
            source={{ uri }}
            style={styles.image}
            resizeMode="contain"
            accessibilityLabel={title || 'Saved image'}
          />
        </View>

        <View
          style={[
            styles.bottomBar,
            { paddingBottom: Math.max(insets.bottom, spacing.lg) },
          ]}
        >
          {status ? (
            <AppText variant="caption" style={styles.statusText}>
              {status}
            </AppText>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={handleSave}
              disabled={!!busy}
              style={[styles.actionBtn, busy === 'save' && styles.actionBtnBusy]}
              accessibilityRole="button"
              accessibilityLabel="Save to gallery"
            >
              {busy === 'save' ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="download-outline" size={20} color="#FFFFFF" />
              )}
              <AppText variant="subtitle" style={styles.actionLabel}>
                Save
              </AppText>
            </Pressable>

            <Pressable
              onPress={handleShare}
              disabled={!!busy}
              style={[styles.actionBtn, styles.actionBtnPrimary, busy === 'share' && styles.actionBtnBusy]}
              accessibilityRole="button"
              accessibilityLabel="Share image"
            >
              {busy === 'share' ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="share-outline" size={20} color="#FFFFFF" />
              )}
              <AppText variant="subtitle" style={styles.actionLabel}>
                Share
              </AppText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  topCopy: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  title: {
    color: '#FFFFFF',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.68,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  statusText: {
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  actionBtnPrimary: {
    backgroundColor: '#0C295F',
  },
  actionBtnBusy: {
    opacity: 0.7,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default ImageViewerModal;
