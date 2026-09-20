/**
 * Model Preview — browse bundled GLB furniture, or view a Unity-exported room layout.
 * Catalog mode: Width / Depth / Height + "View in Room".
 * Export mode: loads the exported .glb from disk after Unity AR export.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as THREE from 'three';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, radii } from '@/components/ui/theme';
import { ExpoThreeRenderer } from '@/utils/ExpoThreeRenderer';
import { furnitureModelLoader } from '@/services/FurnitureModelLoader';
import { getFurnitureById } from '@/data/furnitureLibrary';
import {
  getBundledFurnitureIds,
  getBundledModelMeta,
  type FurnitureModelAssetKey,
} from '@/config/furniture-models';
import { toFileUri, pickUnityExportGlb } from '@/utils/modelPreviewExport';
import { applyRoomExportAppearance } from '@/utils/roomExportAppearance';

/** Meters → whole centimeters for product-style labels. */
function formatCm(meters: number): string {
  return `${Math.round(meters * 100)} cm`;
}

function frameCameraToObject(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  offset = 1.85
): void {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.01);
  const fov = camera.fov * (Math.PI / 180);
  const distance = (maxDim / (2 * Math.tan(fov / 2))) * offset;

  camera.position.set(
    center.x + distance * 0.55,
    center.y + distance * 0.35,
    center.z + distance * 0.75
  );
  camera.near = Math.max(0.01, distance / 100);
  camera.far = Math.max(100, distance * 20);
  camera.lookAt(center.x, center.y, center.z);
  camera.updateProjectionMatrix();
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

export default function ModelPreviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode?: string | string[];
    exportUri?: string | string[];
    exportTitle?: string | string[];
    furnitureCount?: string | string[];
    projectId?: string | string[];
  }>();
  const { colors, statusBarStyle } = useTheme();

  const exportUri = toFileUri(firstParam(params.exportUri));
  const isExportMode = firstParam(params.mode) === 'export' && Boolean(exportUri);
  const exportTitle = firstParam(params.exportTitle) || 'Exported layout';
  const exportFurnitureCount = Number(firstParam(params.furnitureCount) || 0);

  const bundledIds = useMemo(() => getBundledFurnitureIds(), []);
  const [selectedId, setSelectedId] = useState<FurnitureModelAssetKey>(
    bundledIds[0] ?? 'accent-chair'
  );
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [measuredDims, setMeasuredDims] = useState<{
    width: number;
    depth: number;
    height: number;
  } | null>(null);

  const previewItem = useMemo(() => getFurnitureById(selectedId), [selectedId]);
  const meta = useMemo(() => getBundledModelMeta(selectedId), [selectedId]);
  const catalogDims = previewItem?.dimensions ?? meta?.dimensions ?? {
    width: 0.7,
    length: 0.75,
    height: 0.9,
  };
  const displayDims = measuredDims ?? {
    width: catalogDims.width,
    depth: catalogDims.length,
    height: catalogDims.height,
  };
  const furnitureName = isExportMode
    ? exportTitle.replace(/\.glb$/i, '')
    : previewItem?.name ?? selectedId;

  const rafRef = useRef<number | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const mountedRef = useRef(true);
  const sceneKey = isExportMode ? `export:${exportUri}` : selectedId;

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    setMeasuredDims(null);
    setStatus('loading');
    setErrorMessage(null);
  }, [sceneKey]);

  const onContextCreate = useCallback(
    async (gl: ExpoWebGLRenderingContext) => {
      try {
        if (mountedRef.current) {
          setStatus('loading');
          setErrorMessage(null);
        }

        const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;
        const renderer = new ExpoThreeRenderer({ gl, width, height, pixelRatio: 1 });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setClearColor(0xd8d4cc, 1);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xd8d4cc);

        const camera = new THREE.PerspectiveCamera(40, width / Math.max(height, 1), 0.05, 100);

        scene.add(new THREE.AmbientLight(0xffffff, 1.0));
        scene.add(new THREE.HemisphereLight(0xffffff, 0xb0a090, 0.85));

        const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
        keyLight.position.set(2.5, 4, 3);
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0xfff5e8, 0.55);
        fillLight.position.set(-3, 2, -1.5);
        scene.add(fillLight);

        if (!isExportMode) {
          const floor = new THREE.Mesh(
            new THREE.CircleGeometry(1.6, 64),
            new THREE.MeshStandardMaterial({
              color: 0xcfc9bf,
              roughness: 0.95,
              metalness: 0,
            })
          );
          floor.rotation.x = -Math.PI / 2;
          floor.position.y = -0.001;
          scene.add(floor);
        }

        let model: THREE.Object3D | null = null;
        if (isExportMode) {
          model = await furnitureModelLoader.loadGLBModel(exportUri, 1.0, {
            preferTextures: true,
          });
          if (!model) {
            throw new Error(`Failed to load exported layout from ${exportUri}`);
          }
          // Match Unity planner shell (grid floor / walls) even if the GLB is untextured.
          applyRoomExportAppearance(model);
        } else {
          model = await furnitureModelLoader.loadBundledFurniture(selectedId, {
            width: catalogDims.width,
            length: catalogDims.length,
            height: catalogDims.height,
          });
          if (!model) {
            throw new Error(`Failed to load ${selectedId}.glb`);
          }
        }

        let meshCount = 0;
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            meshCount += 1;
            child.visible = true;
          }
        });
        console.log('[ModelPreview] Mesh count:', meshCount, sceneKey);

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());

        modelRef.current = model;
        scene.add(model);
        frameCameraToObject(camera, model, isExportMode ? 2.35 : 1.85);

        if (mountedRef.current) {
          setMeasuredDims({
            width: size.x,
            depth: size.z,
            height: size.y,
          });
          setStatus('ready');
        }

        const spinSpeed = isExportMode ? 0.0025 : 0.01;
        const animate = () => {
          if (!mountedRef.current) return;
          rafRef.current = requestAnimationFrame(animate);
          if (modelRef.current) {
            modelRef.current.rotation.y += spinSpeed;
          }
          renderer.render(scene, camera);
          gl.endFrameEXP();
        };
        animate();
      } catch (error) {
        console.error('[ModelPreview] Setup failed:', error);
        if (mountedRef.current) {
          setStatus('error');
          setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
        }
      }
    },
    [
      catalogDims.height,
      catalogDims.length,
      catalogDims.width,
      exportUri,
      isExportMode,
      sceneKey,
      selectedId,
    ]
  );

  const goBackSafe = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    // Export opens from AR or Projects; catalog opens from Home.
    router.replace(isExportMode ? '/projects' : '/(tabs)');
  }, [isExportMode, router]);

  const openExportedLayout = useCallback(async () => {
    const result = await pickUnityExportGlb({ saveToProjects: true });
    if ('cancelled' in result) return;
    if ('error' in result) {
      Alert.alert('Could not open export', result.error);
      return;
    }
    router.push(result.href);
  }, [router]);

  const openInRoom = () => {
    router.push({
      pathname: '/room-view',
      params: { furniture: selectedId },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={goBackSafe} accessibilityRole="button">
            <Text style={[styles.back, { color: colors.accent }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {isExportMode ? 'Exported Layout' : '3D Furniture Preview'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {!isExportMode ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pickerRow}
            style={styles.pickerScroll}
          >
            {bundledIds.map((id) => {
              const item = getFurnitureById(id);
              const selected = id === selectedId;
              return (
                <TouchableOpacity
                  key={id}
                  style={[
                    styles.pickerChip,
                    {
                      backgroundColor: selected ? colors.accent : colors.surfacePrimary,
                      borderColor: selected ? colors.accent : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedId(id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[
                      styles.pickerChipText,
                      { color: selected ? '#FFFFFF' : colors.textPrimary },
                    ]}
                    numberOfLines={1}
                  >
                    {item?.name ?? id}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={styles.canvasWrap}>
          <GLView key={sceneKey} style={styles.gl} onContextCreate={onContextCreate} />

          {status === 'loading' && (
            <View style={styles.overlay}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.overlayText, { color: colors.textSecondary }]}>
                {isExportMode ? 'Loading exported layout…' : `Loading ${furnitureName}…`}
              </Text>
            </View>
          )}

          {status === 'error' && (
            <View style={styles.overlay}>
              <Text style={[styles.overlayText, { color: '#C45C4A' }]}>
                {errorMessage || 'Could not load 3D model'}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.footer, { backgroundColor: colors.surfacePrimary }]}>
          <Text style={[styles.footerTitle, { color: colors.textPrimary }]}>{furnitureName}</Text>
          <Text style={[styles.footerSub, { color: colors.textSecondary }]}>
            {isExportMode
              ? status === 'ready'
                ? `Unity AR export${exportFurnitureCount > 0 ? ` · ${exportFurnitureCount} furniture` : ''}`
                : status === 'loading'
                  ? 'Preparing exported room layout…'
                  : 'Could not open the exported GLB file'
              : status === 'ready'
                ? 'Exact size from the 3D model — open AR to place it in your room'
                : status === 'loading'
                  ? 'Preparing WebGL scene…'
                  : 'Check Metro logs for loader errors'}
          </Text>

          <View
            style={[styles.dimensionsRow, { borderColor: colors.border }]}
            accessibilityLabel={`Width ${formatCm(displayDims.width)}, depth ${formatCm(displayDims.depth)}, height ${formatCm(displayDims.height)}`}
          >
            <View style={styles.dimensionCell}>
              <Text style={[styles.dimensionLabel, { color: colors.textMuted }]}>Width</Text>
              <Text style={[styles.dimensionValue, { color: colors.textPrimary }]}>
                {formatCm(displayDims.width)}
              </Text>
            </View>
            <View style={[styles.dimensionDivider, { backgroundColor: colors.border }]} />
            <View style={styles.dimensionCell}>
              <Text style={[styles.dimensionLabel, { color: colors.textMuted }]}>Depth</Text>
              <Text style={[styles.dimensionValue, { color: colors.textPrimary }]}>
                {formatCm(displayDims.depth)}
              </Text>
            </View>
            <View style={[styles.dimensionDivider, { backgroundColor: colors.border }]} />
            <View style={styles.dimensionCell}>
              <Text style={[styles.dimensionLabel, { color: colors.textMuted }]}>Height</Text>
              <Text style={[styles.dimensionValue, { color: colors.textPrimary }]}>
                {formatCm(displayDims.height)}
              </Text>
            </View>
          </View>

          {isExportMode ? (
            <TouchableOpacity
              style={[styles.arButton, { backgroundColor: colors.accent }]}
              onPress={goBackSafe}
              accessibilityRole="button"
              accessibilityLabel="Done viewing exported layout"
            >
              <Text style={styles.arButtonText}>Done</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.arButton,
                  { backgroundColor: colors.accent },
                  status !== 'ready' && styles.arButtonDisabled,
                ]}
                onPress={openInRoom}
                disabled={status !== 'ready'}
                accessibilityRole="button"
                accessibilityLabel="View furniture in room with AR"
              >
                <Text style={styles.arButtonText}>View in My Room (AR)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.border }]}
                onPress={openExportedLayout}
                accessibilityRole="button"
                accessibilityLabel="Open a Unity exported GLB layout"
              >
                <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>
                  Open Unity export (.glb)
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 64,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSpacer: {
    minWidth: 64,
  },
  pickerScroll: {
    flexGrow: 0,
  },
  pickerRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  pickerChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pickerChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  canvasWrap: {
    flex: 1,
    position: 'relative',
  },
  gl: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  overlayText: {
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    gap: spacing.sm,
  },
  footerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  footerSub: {
    fontSize: 13,
  },
  dimensionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  dimensionCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  dimensionDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  dimensionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  dimensionValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  arButton: {
    marginTop: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  arButtonDisabled: {
    opacity: 0.5,
  },
  arButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
