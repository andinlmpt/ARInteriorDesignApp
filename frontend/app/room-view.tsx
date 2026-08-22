/**
 * Room View — camera + GLB furniture locked to a virtual floor plane.
 * Drag slides the chair on the floor (Y stays 0). Pinch scales, twist rotates.
 * For real ARCore floor detection, use "True Floor AR".
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  PanResponder,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as THREE from 'three';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, radii } from '@/components/ui/theme';
import { ExpoThreeRenderer } from '@/utils/ExpoThreeRenderer';
import { furnitureModelLoader } from '@/services/FurnitureModelLoader';
import { createContactShadow } from '@/utils/arModelEnhancer';
import { getFurnitureById } from '@/data/furnitureLibrary';
import { getBundledModelMeta, hasBundledModel } from '@/config/furniture-models';

const FLOOR_Y = 0;
const MIN_SCALE = 0.4;
const MAX_SCALE = 2.5;

export default function RoomViewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ furniture?: string }>();
  const furnitureId = useMemo(() => {
    const id = typeof params.furniture === 'string' ? params.furniture : 'accent-chair';
    return hasBundledModel(id) ? id : 'accent-chair';
  }, [params.furniture]);
  const furnitureItem = useMemo(() => getFurnitureById(furnitureId), [furnitureId]);
  const furnitureDims = useMemo(() => {
    return (
      furnitureItem?.dimensions ??
      getBundledModelMeta(furnitureId)?.dimensions ?? {
        width: 0.83,
        length: 0.57,
        height: 0.69,
      }
    );
  }, [furnitureId, furnitureItem]);
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hint, setHint] = useState('Point camera at the floor, then drag to slide the furniture');
  const [cameraActive, setCameraActive] = useState(true);
  const [openingUnity, setOpeningUnity] = useState(false);

  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const shadowRef = useRef<THREE.Mesh | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const glSizeRef = useRef({ width: 1, height: 1 });
  const viewLayoutRef = useRef({ width: 1, height: 1 });
  const raycasterRef = useRef(new THREE.Raycaster());
  const floorPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLOOR_Y));
  const hitPointRef = useRef(new THREE.Vector3());
  const ndcRef = useRef(new THREE.Vector2());

  const poseRef = useRef({
    x: 0,
    z: -1.6,
    scale: 1,
    rotationY: 0,
  });
  const gestureRef = useRef({
    mode: 'none' as 'none' | 'pan' | 'pinch',
    startDistance: 0,
    startScale: 1,
    startAngle: 0,
    startRotationY: 0,
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const distanceBetween = (touches: readonly { pageX: number; pageY: number }[]) => {
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.hypot(dx, dy);
  };

  const angleBetween = (touches: readonly { pageX: number; pageY: number }[]) => {
    return Math.atan2(
      touches[1].pageY - touches[0].pageY,
      touches[1].pageX - touches[0].pageX
    );
  };

  /** Project a screen point onto the virtual floor (y = 0). */
  const placeOnFloorFromScreen = useCallback((locationX: number, locationY: number) => {
    const camera = cameraRef.current;
    if (!camera) return;

    const { width, height } = viewLayoutRef.current;
    if (width <= 0 || height <= 0) return;

    ndcRef.current.set((locationX / width) * 2 - 1, -(locationY / height) * 2 + 1);
    raycasterRef.current.setFromCamera(ndcRef.current, camera);

    const hit = raycasterRef.current.ray.intersectPlane(floorPlaneRef.current, hitPointRef.current);
    if (!hit) return;

    // Keep furniture in front of the camera, on the floor.
    poseRef.current.x = Math.max(-2.5, Math.min(2.5, hit.x));
    poseRef.current.z = Math.max(-4.5, Math.min(-0.6, hit.z));
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const touches = evt.nativeEvent.touches;
          const g = gestureRef.current;
          if (touches.length >= 2) {
            g.mode = 'pinch';
            g.startDistance = distanceBetween(touches);
            g.startScale = poseRef.current.scale;
            g.startAngle = angleBetween(touches);
            g.startRotationY = poseRef.current.rotationY;
          } else {
            g.mode = 'pan';
            placeOnFloorFromScreen(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
            setHint('Chair is on the floor — drag to slide, pinch to scale');
          }
        },
        onPanResponderMove: (evt) => {
          const touches = evt.nativeEvent.touches;
          const g = gestureRef.current;
          const pose = poseRef.current;

          if (touches.length >= 2) {
            const dist = distanceBetween(touches);
            const angle = angleBetween(touches);
            if (g.startDistance > 0) {
              pose.scale = Math.min(
                MAX_SCALE,
                Math.max(MIN_SCALE, g.startScale * (dist / g.startDistance))
              );
            }
            pose.rotationY = g.startRotationY + (angle - g.startAngle);
            g.mode = 'pinch';
            return;
          }

          placeOnFloorFromScreen(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
        },
        onPanResponderRelease: () => {
          gestureRef.current.mode = 'none';
        },
      }),
    [placeOnFloorFromScreen]
  );

  const onContextCreate = useCallback(async (gl: ExpoWebGLRenderingContext) => {
    try {
      if (mountedRef.current) {
        setStatus('loading');
        setErrorMessage(null);
      }

      const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;
      glSizeRef.current = { width, height };

      const renderer = new ExpoThreeRenderer({ gl, width, height, pixelRatio: 1 });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();

      // Eye-height camera looking down toward the floor ahead (chair sits on floor).
      const camera = new THREE.PerspectiveCamera(50, width / Math.max(height, 1), 0.05, 40);
      camera.position.set(0, 1.35, 0.15);
      camera.lookAt(0, 0, -2.2);
      cameraRef.current = camera;

      scene.add(new THREE.AmbientLight(0xffffff, 1.0));
      scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 0.75));
      const key = new THREE.DirectionalLight(0xffffff, 1.05);
      key.position.set(2, 5, 1);
      scene.add(key);

      const model = await furnitureModelLoader.loadBundledFurniture(furnitureId, furnitureDims);
      if (!model) throw new Error(`Failed to load ${furnitureId}.glb`);

      // fitModelToDimensions already puts the bottom at y=0 — keep it there.
      model.position.set(poseRef.current.x, FLOOR_Y, poseRef.current.z);
      modelRef.current = model;
      scene.add(model);

      const shadow = createContactShadow(furnitureDims.width, furnitureDims.length);
      shadow.position.set(poseRef.current.x, FLOOR_Y + 0.002, poseRef.current.z);
      shadowRef.current = shadow;
      scene.add(shadow);

      if (mountedRef.current) {
        setStatus('ready');
        setHint('Point at your floor, then tap/drag — furniture stays on the ground');
      }

      const animate = () => {
        if (!mountedRef.current) return;
        rafRef.current = requestAnimationFrame(animate);

        const pose = poseRef.current;
        if (modelRef.current) {
          // Y is always floor — never float mid-air.
          modelRef.current.position.set(pose.x, FLOOR_Y, pose.z);
          modelRef.current.scale.setScalar(pose.scale);
          modelRef.current.rotation.set(0, pose.rotationY, 0);
        }
        if (shadowRef.current) {
          shadowRef.current.position.set(pose.x, FLOOR_Y + 0.002, pose.z);
          shadowRef.current.scale.setScalar(pose.scale);
          shadowRef.current.rotation.y = pose.rotationY;
        }

        renderer.render(scene, camera);
        gl.endFrameEXP();
      };
      animate();
    } catch (error) {
      console.error('[RoomView] Setup failed:', error);
      if (mountedRef.current) {
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }, [furnitureDims, furnitureId]);

  const resetPose = () => {
    poseRef.current = { x: 0, z: -1.6, scale: 1, rotationY: 0 };
    setHint('Reset — furniture is back on the floor in front of you');
  };

  const openTrueFloorAr = () => {
    if (openingUnity) return;
    setOpeningUnity(true);
    setHint('Releasing camera for Unity AR…');

    // Stop the GL render loop and unmount CameraView before Unity starts.
    // Both Expo Camera and Unity ARCore need exclusive camera access — keeping
    // the preview alive while mounting Unity crashes libunity.so on Android.
    mountedRef.current = false;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setCameraActive(false);

    setTimeout(() => {
      router.replace({
        pathname: '/ar-view',
        params: { furniture: furnitureId },
      });
    }, 900);
  };

  if (!permission) {
    return (
      <View style={[styles.centered, { backgroundColor: '#000' }]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.centered, { backgroundColor: '#111' }]}>
        <Text style={styles.permTitle}>Camera access needed</Text>
        <Text style={styles.permBody}>
          Allow camera access to visualize the chair on your floor.
        </Text>
        <TouchableOpacity
          style={[styles.permButton, { backgroundColor: colors.accent }]}
          onPress={requestPermission}
        >
          <Text style={styles.permButtonText}>Allow Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.linkBack}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {cameraActive ? (
        <CameraView style={StyleSheet.absoluteFill} facing="back" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />
      )}

      {cameraActive ? (
        <View
          style={StyleSheet.absoluteFill}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            viewLayoutRef.current = { width, height };
          }}
          {...panResponder.panHandlers}
        >
          <GLView style={styles.gl} onContextCreate={onContextCreate} />
        </View>
      ) : null}

      <SafeAreaView style={styles.ui} pointerEvents="box-none" edges={['top', 'bottom']}>
        <View style={styles.topBar} pointerEvents="box-none">
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} accessibilityRole="button">
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>On Your Floor</Text>
          <TouchableOpacity style={styles.iconBtn} onPress={resetPose} accessibilityRole="button">
            <Ionicons name="refresh" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {status === 'loading' && (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.loadingText}>Placing chair on the floor…</Text>
          </View>
        )}

        {status === 'error' && (
          <View style={styles.loadingBox}>
            <Text style={styles.errorText}>{errorMessage || 'Could not load model'}</Text>
          </View>
        )}

        <View style={styles.bottomCard}>
          <Text style={styles.cardTitle}>Accent Chair</Text>
          <Text style={styles.cardHint}>{hint}</Text>
          <Text style={styles.cardNote}>
            Legs stay on the ground plane · Pinch to scale · Twist to rotate
          </Text>

          <TouchableOpacity
            style={[
              styles.arButton,
              { backgroundColor: colors.accent },
              openingUnity && styles.arButtonDisabled,
            ]}
            onPress={openTrueFloorAr}
            disabled={openingUnity || status !== 'ready'}
            accessibilityRole="button"
          >
            <Text style={styles.arButtonText}>
              {openingUnity ? 'Opening Unity AR…' : 'Try True Floor AR'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  gl: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  ui: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
  },
  loadingBox: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: '#fff',
    fontSize: 14,
  },
  errorText: {
    color: '#ffb4a8',
    fontSize: 14,
    textAlign: 'center',
  },
  bottomCard: {
    margin: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.95)',
    gap: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  cardHint: {
    fontSize: 13,
    color: '#444',
  },
  cardNote: {
    fontSize: 12,
    color: '#777',
    marginBottom: spacing.sm,
  },
  arButton: {
    marginTop: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  arButtonDisabled: {
    opacity: 0.6,
  },
  arButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  permTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  permBody: {
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  permButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  permButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  linkBack: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: spacing.sm,
  },
});
