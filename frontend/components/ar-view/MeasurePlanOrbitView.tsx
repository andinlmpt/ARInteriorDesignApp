/**
 * Interactive open-top room shell for AR Measurement plan view.
 * Renders in RN (expo-gl) so drag/pinch work even when Unity UaaL steals touches.
 * Supports placing catalog furniture into the layout and exporting room + pieces as GLB.
 */

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  type StyleProp,
  type ViewStyle,
  type LayoutChangeEvent,
} from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { Directory, File, Paths } from 'expo-file-system';
import { ExpoThreeRenderer } from '@/utils/ExpoThreeRenderer';
import { toFileUri } from '@/utils/modelPreviewExport';
import { spacing, radii } from '@/components/ui/theme';

type OrbitState = {
  target: THREE.Vector3;
  radius: number;
  theta: number;
  phi: number;
};

type DimLabel = {
  key: 'w' | 'l' | 'h';
  text: string;
  x: number;
  y: number;
  visible: boolean;
};

export type MeasurePlanPlaceItem = {
  id: string;
  name: string;
  glbUrl?: string;
  /** Catalog product photo — used as a lightweight stand-in (full GLBs OOM on Android). */
  thumbnail?: string;
  color?: string;
  dimensions: { width: number; length: number; height: number };
};

export type MeasurePlanExportResult = {
  uri: string;
  fileName: string;
  byteLength: number;
  furnitureCount: number;
};

export type MeasurePlanOrbitHandle = {
  placeFurniture: (item: MeasurePlanPlaceItem) => Promise<void>;
  undoLast: () => boolean;
  clearFurniture: () => void;
  getFurnitureCount: () => number;
  exportGlb: (nameHint?: string) => Promise<MeasurePlanExportResult>;
};

function formatCm(metres: number): string {
  return `${Math.round(Math.max(0, metres) * 100)} cm`;
}

function applyOrbitToCamera(camera: THREE.PerspectiveCamera, orbit: OrbitState): void {
  const phi = Math.max(0.2, Math.min(Math.PI * 0.48, orbit.phi));
  const sinPhi = Math.sin(phi);
  camera.position.set(
    orbit.target.x + orbit.radius * sinPhi * Math.sin(orbit.theta),
    orbit.target.y + orbit.radius * Math.cos(phi),
    orbit.target.z + orbit.radius * sinPhi * Math.cos(orbit.theta)
  );
  camera.lookAt(orbit.target);
}

function touchDistance(touches: readonly { pageX: number; pageY: number }[]): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

function makeShellMaterial(color: number, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
  });
}

function buildRoomShell(width: number, depth: number, height: number): THREE.Group {
  const w = Math.max(0.5, width);
  const d = Math.max(0.5, depth);
  const h = Math.max(0.5, height);
  const group = new THREE.Group();
  group.name = 'MeasuredRoomShell';

  const floorMat = makeShellMaterial(0x6b6e70);
  const wallMat = makeShellMaterial(0xf0f0ed);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x9a9a94 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.name = 'Room_Floor';
  group.add(floor);

  const divisions = Math.max(4, Math.round(Math.max(w, d) * 2));
  const grid = new THREE.GridHelper(1, divisions, 0xffffff, 0xc5c8ce);
  grid.scale.set(w, 1, d);
  grid.position.y = 0.01;
  group.add(grid);

  const addWall = (ww: number, hh: number, x: number, y: number, z: number, rotY: number, name: string) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(ww, hh), wallMat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.name = name;
    group.add(mesh);

    const edges = new THREE.EdgesGeometry(new THREE.PlaneGeometry(ww, hh));
    const line = new THREE.LineSegments(edges, edgeMat);
    line.position.copy(mesh.position);
    line.rotation.copy(mesh.rotation);
    group.add(line);
  };

  addWall(w, h, 0, h / 2, -d / 2, 0, 'Room_Wall_Back');
  addWall(w, h, 0, h / 2, d / 2, Math.PI, 'Room_Wall_Front');
  addWall(d, h, -w / 2, h / 2, 0, Math.PI / 2, 'Room_Wall_Left');
  addWall(d, h, w / 2, h / 2, 0, -Math.PI / 2, 'Room_Wall_Right');

  const outline = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-w / 2, 0.015, -d / 2),
    new THREE.Vector3(w / 2, 0.015, -d / 2),
    new THREE.Vector3(w / 2, 0.015, d / 2),
    new THREE.Vector3(-w / 2, 0.015, d / 2),
    new THREE.Vector3(-w / 2, 0.015, -d / 2),
  ]);
  group.add(new THREE.Line(outline, new THREE.LineBasicMaterial({ color: 0x2a2e36 })));

  return group;
}

function projectToScreen(
  world: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
  viewW: number,
  viewH: number
): { x: number; y: number; visible: boolean } {
  const v = world.clone().project(camera);
  const visible = v.z > -1 && v.z < 1 && Math.abs(v.x) <= 1.35 && Math.abs(v.y) <= 1.35;
  return {
    x: ((v.x + 1) / 2) * viewW,
    y: ((1 - v.y) / 2) * viewH,
    visible,
  };
}

function slotOnFloor(index: number, roomW: number, roomD: number): { x: number; z: number } {
  const spacing = 0.85;
  const cols = Math.max(1, Math.floor(Math.max(roomW - 0.6, spacing) / spacing));
  const col = index % cols;
  const row = Math.floor(index / cols);
  const usableW = Math.max(spacing, roomW - 0.8);
  const usableD = Math.max(spacing, roomD - 0.8);
  const x = -usableW / 2 + (cols <= 1 ? usableW / 2 : (col / Math.max(1, cols - 1)) * usableW);
  const z = -usableD / 2 + Math.min(row * spacing, usableD);
  return { x, z };
}

function parseCssColor(color?: string): number {
  if (!color) return 0x8b7355;
  const hex = color.trim().replace('#', '');
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return Number.parseInt(hex, 16);
  return 0x8b7355;
}

function loadThumbnailTexture(url?: string): Promise<THREE.Texture | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        resolve(tex);
      },
      undefined,
      () => resolve(null)
    );
  });
}

async function buildFurnitureVisual(
  item: MeasurePlanPlaceItem,
  dims: { width: number; length: number; height: number }
): Promise<THREE.Object3D> {
  const group = new THREE.Group();
  const baseColor = parseCssColor(item.color);
  const tex = await loadThumbnailTexture(item.thumbnail);

  // Footprint on the floor (true catalog L × W).
  const footprint = new THREE.Mesh(
    new THREE.PlaneGeometry(dims.width, dims.length),
    new THREE.MeshBasicMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
    })
  );
  footprint.rotation.x = -Math.PI / 2;
  footprint.position.y = 0.01;
  footprint.name = 'Footprint';
  group.add(footprint);

  // Product photo card — shows the real sofa image at roughly catalog size.
  const cardH = Math.max(0.35, dims.height * 0.85);
  const cardW = Math.max(dims.width, dims.length * 0.55);
  const cardMat = new THREE.MeshBasicMaterial({
    map: tex ?? undefined,
    color: tex ? 0xffffff : baseColor,
    side: THREE.DoubleSide,
    transparent: !tex,
    opacity: tex ? 1 : 0.92,
  });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(cardW, cardH), cardMat);
  card.position.y = cardH / 2 + 0.02;
  card.name = 'ProductCard';
  group.add(card);

  // Thin side “block” so the piece reads in 3D from every orbit angle.
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(dims.width * 0.92, Math.max(0.12, dims.height * 0.28), dims.length * 0.92),
    new THREE.MeshBasicMaterial({
      color: baseColor,
      transparent: true,
      opacity: 0.55,
    })
  );
  body.position.y = Math.max(0.06, dims.height * 0.14);
  body.name = 'Body';
  group.add(body);

  // Selection ring (hidden until selected).
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(
      Math.max(dims.width, dims.length) * 0.55,
      Math.max(dims.width, dims.length) * 0.62,
      48
    ),
    new THREE.MeshBasicMaterial({
      color: 0x2563eb,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.015;
  ring.name = 'SelectRing';
  group.add(ring);

  return group;
}

function findPlacedRoot(obj: THREE.Object3D | null): THREE.Object3D | null {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (typeof cur.userData?.modelId === 'string') return cur;
    cur = cur.parent;
  }
  return null;
}

function setRingVisible(root: THREE.Object3D, visible: boolean) {
  const ring = root.getObjectByName('SelectRing');
  if (ring instanceof THREE.Mesh && ring.material instanceof THREE.MeshBasicMaterial) {
    ring.material.opacity = visible ? 0.9 : 0;
  }
}

export const MeasurePlanOrbitView = forwardRef<
  MeasurePlanOrbitHandle,
  {
    width: number;
    depth: number;
    height: number;
    libraryOpen?: boolean;
    style?: StyleProp<ViewStyle>;
    onFurnitureCountChange?: (count: number) => void;
  }
>(function MeasurePlanOrbitView(
  { width, depth, height, libraryOpen = false, style, onFurnitureCountChange },
  ref
) {
  const rafRef = useRef<number | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const furnitureRootRef = useRef<THREE.Group | null>(null);
  const orbitRef = useRef<OrbitState | null>(null);
  const viewSizeRef = useRef({ w: 1, h: 1 });
  const readyRef = useRef(false);
  const labelWorldRef = useRef<{
    w: THREE.Vector3;
    l: THREE.Vector3;
    h: THREE.Vector3;
  } | null>(null);
  const frameSkipRef = useRef(0);
  const placedRef = useRef<THREE.Object3D[]>([]);
  const gestureRef = useRef({
    mode: 'none' as 'none' | 'orbit' | 'pinch' | 'drag',
    lastX: 0,
    lastY: 0,
    startPinch: 0,
    startRadius: 1,
    dragTarget: null as THREE.Object3D | null,
  });
  const selectedRef = useRef<THREE.Object3D | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const floorPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const hitPointRef = useRef(new THREE.Vector3());
  const dimsRef = useRef({ width, depth, height });
  dimsRef.current = { width, depth, height };

  const selectFurniture = (next: THREE.Object3D | null) => {
    if (selectedRef.current) setRingVisible(selectedRef.current, false);
    selectedRef.current = next;
    if (next) setRingVisible(next, true);
  };

  const ndcFromLocation = (locationX: number, locationY: number) => {
    const { w, h } = viewSizeRef.current;
    return new THREE.Vector2((locationX / Math.max(1, w)) * 2 - 1, -(locationY / Math.max(1, h)) * 2 + 1);
  };

  const pickFurniture = (locationX: number, locationY: number): THREE.Object3D | null => {
    const camera = cameraRef.current;
    if (!camera || placedRef.current.length === 0) return null;
    const raycaster = raycasterRef.current;
    raycaster.setFromCamera(ndcFromLocation(locationX, locationY), camera);
    const hits = raycaster.intersectObjects(placedRef.current, true);
    if (!hits.length) return null;
    return findPlacedRoot(hits[0].object);
  };

  const dragFurnitureTo = (locationX: number, locationY: number, target: THREE.Object3D) => {
    const camera = cameraRef.current;
    if (!camera) return;
    const raycaster = raycasterRef.current;
    raycaster.setFromCamera(ndcFromLocation(locationX, locationY), camera);
    const point = hitPointRef.current;
    if (!raycaster.ray.intersectPlane(floorPlaneRef.current, point)) return;

    const { width: rw, depth: rd } = dimsRef.current;
    const margin = 0.25;
    const halfW = Math.max(0.1, rw / 2 - margin);
    const halfD = Math.max(0.1, rd / 2 - margin);
    target.position.x = Math.max(-halfW, Math.min(halfW, point.x));
    target.position.z = Math.max(-halfD, Math.min(halfD, point.z));
    target.position.y = 0;
  };

  const [labels, setLabels] = useState<DimLabel[]>([
    { key: 'w', text: `W = ${formatCm(width)}`, x: 0, y: 0, visible: false },
    { key: 'l', text: `L = ${formatCm(depth)}`, x: 0, y: 0, visible: false },
    { key: 'h', text: `H = ${formatCm(height)}`, x: 0, y: 0, visible: false },
  ]);

  useEffect(() => {
    setLabels([
      { key: 'w', text: `W = ${formatCm(width)}`, x: 0, y: 0, visible: false },
      { key: 'l', text: `L = ${formatCm(depth)}`, x: 0, y: 0, visible: false },
      { key: 'h', text: `H = ${formatCm(height)}`, x: 0, y: 0, visible: false },
    ]);
  }, [width, depth, height]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const notifyCount = () => {
    onFurnitureCountChange?.(placedRef.current.length);
  };

  const updateLabelScreenPositions = () => {
    const camera = cameraRef.current;
    const worlds = labelWorldRef.current;
    if (!camera || !worlds) return;
    const { w: vw, h: vh } = viewSizeRef.current;
    if (vw < 2 || vh < 2) return;

    const next: DimLabel[] = [
      { key: 'w', text: `W = ${formatCm(dimsRef.current.width)}`, ...projectToScreen(worlds.w, camera, vw, vh) },
      { key: 'l', text: `L = ${formatCm(dimsRef.current.depth)}`, ...projectToScreen(worlds.l, camera, vw, vh) },
      { key: 'h', text: `H = ${formatCm(dimsRef.current.height)}`, ...projectToScreen(worlds.h, camera, vw, vh) },
    ];
    setLabels(next);
  };

  useImperativeHandle(
    ref,
    () => ({
      placeFurniture: async (item) => {
        const scene = sceneRef.current;
        const furnitureRoot = furnitureRootRef.current;
        if (!scene || !furnitureRoot || !readyRef.current) {
          throw new Error('Layout viewer is not ready yet');
        }

        const { width: rw, depth: rd } = dimsRef.current;
        const dims = {
          width: Math.max(0.2, item.dimensions.width || 0.6),
          length: Math.max(0.2, item.dimensions.length || 0.6),
          height: Math.max(0.2, item.dimensions.height || 0.6),
        };

        // Catalog sofas are 100–250 MB — use thumbnail stand-ins on the plan (full GLB = Unity AR).
        const object = await buildFurnitureVisual(item, dims);

        const slot = slotOnFloor(placedRef.current.length, rw, rd);
        const wrapper = new THREE.Group();
        wrapper.name = `Placed_${item.id}_${placedRef.current.length}`;
        wrapper.userData.modelId = item.id;
        wrapper.userData.displayName = item.name;
        wrapper.userData.footprint = { width: dims.width, length: dims.length };
        wrapper.add(object);
        wrapper.position.set(slot.x, 0, slot.z);
        furnitureRoot.add(wrapper);
        placedRef.current.push(wrapper);
        selectFurniture(wrapper);
        notifyCount();
      },

      undoLast: () => {
        const last = placedRef.current.pop();
        if (!last) return false;
        if (selectedRef.current === last) selectedRef.current = null;
        last.removeFromParent();
        notifyCount();
        return true;
      },

      clearFurniture: () => {
        const root = furnitureRootRef.current;
        placedRef.current.forEach((obj) => obj.removeFromParent());
        placedRef.current = [];
        selectedRef.current = null;
        if (root) {
          while (root.children.length) root.remove(root.children[0]);
        }
        notifyCount();
      },

      getFurnitureCount: () => placedRef.current.length,

      exportGlb: async (nameHint) => {
        const scene = sceneRef.current;
        if (!scene || !readyRef.current) {
          throw new Error('Layout viewer is not ready yet');
        }

        const exporter = new GLTFExporter();
        const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          exporter.parse(
            scene,
            (result) => {
              if (result instanceof ArrayBuffer) {
                resolve(result);
                return;
              }
              reject(new Error('GLTFExporter did not return binary GLB'));
            },
            (err) => reject(err instanceof Error ? err : new Error(String(err))),
            { binary: true, onlyVisible: true }
          );
        });

        const stamp = new Date()
          .toISOString()
          .replace(/[-:]/g, '')
          .replace(/\.\d+Z$/, '')
          .replace('T', '-');
        const safeHint = (nameHint || 'room')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 32);
        const fileName = `room-layout-${safeHint || 'room'}-${stamp}.glb`;

        const dir = new Directory(Paths.document, 'room-exports');
        if (!dir.exists) {
          dir.create({ intermediates: true, idempotent: true });
        }
        const file = new File(dir, fileName);
        if (file.exists) file.delete();
        file.create({ intermediates: true, overwrite: true });
        file.write(new Uint8Array(buffer));

        return {
          uri: toFileUri(file.uri),
          fileName,
          byteLength: buffer.byteLength,
          furnitureCount: placedRef.current.length,
        };
      },
    }),
    [onFurnitureCountChange]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (evt) => {
          const orbit = orbitRef.current;
          if (!orbit) return;
          const touches = evt.nativeEvent.touches;
          const g = gestureRef.current;
          if (touches.length >= 2) {
            g.mode = 'pinch';
            g.dragTarget = null;
            g.startPinch = touchDistance(touches);
            g.startRadius = orbit.radius;
            return;
          }

          const { locationX, locationY, pageX, pageY } = evt.nativeEvent;
          const hit = pickFurniture(locationX, locationY);
          if (hit) {
            g.mode = 'drag';
            g.dragTarget = hit;
            selectFurniture(hit);
            dragFurnitureTo(locationX, locationY, hit);
            return;
          }

          g.mode = 'orbit';
          g.dragTarget = null;
          g.lastX = pageX;
          g.lastY = pageY;
        },
        onPanResponderMove: (evt) => {
          const orbit = orbitRef.current;
          const camera = cameraRef.current;
          if (!orbit || !camera) return;
          const touches = evt.nativeEvent.touches;
          const g = gestureRef.current;

          if (touches.length >= 2 || g.mode === 'pinch') {
            g.mode = 'pinch';
            const dist = touchDistance(touches);
            if (g.startPinch > 1) {
              const scale = g.startPinch / Math.max(1, dist);
              orbit.radius = Math.max(1.2, Math.min(18, g.startRadius * scale));
              applyOrbitToCamera(camera, orbit);
            }
            return;
          }

          if (g.mode === 'drag' && g.dragTarget) {
            dragFurnitureTo(evt.nativeEvent.locationX, evt.nativeEvent.locationY, g.dragTarget);
            return;
          }

          if (g.mode !== 'orbit') {
            g.mode = 'orbit';
            g.lastX = evt.nativeEvent.pageX;
            g.lastY = evt.nativeEvent.pageY;
            return;
          }

          const dx = evt.nativeEvent.pageX - g.lastX;
          const dy = evt.nativeEvent.pageY - g.lastY;
          g.lastX = evt.nativeEvent.pageX;
          g.lastY = evt.nativeEvent.pageY;
          if (Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2) return;

          orbit.theta -= dx * 0.01;
          orbit.phi += dy * 0.01;
          applyOrbitToCamera(camera, orbit);
        },
        onPanResponderRelease: () => {
          gestureRef.current.mode = 'none';
          gestureRef.current.dragTarget = null;
        },
        onPanResponderTerminate: () => {
          gestureRef.current.mode = 'none';
          gestureRef.current.dragTarget = null;
        },
      }),
    []
  );

  const onLayout = (e: LayoutChangeEvent) => {
    viewSizeRef.current = {
      w: e.nativeEvent.layout.width,
      h: e.nativeEvent.layout.height,
    };
  };

  const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
    const { drawingBufferWidth: glW, drawingBufferHeight: glH } = gl;
    const renderer = new ExpoThreeRenderer({
      gl,
      width: glW,
      height: glH,
      pixelRatio: 1,
    });
    renderer.setClearColor(0xededf0, 1);

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(45, glW / Math.max(1, glH), 0.05, 80);
    cameraRef.current = camera;

    const { width: rw, depth: rd, height: rh } = dimsRef.current;
    scene.add(buildRoomShell(rw, rd, rh));

    const furnitureRoot = new THREE.Group();
    furnitureRoot.name = 'PlacedFurniture';
    furnitureRootRef.current = furnitureRoot;
    scene.add(furnitureRoot);

    const pad = Math.max(0.12, Math.min(rw, rd) * 0.06);
    labelWorldRef.current = {
      w: new THREE.Vector3(0, 0.12, -rd / 2 - pad),
      l: new THREE.Vector3(-rw / 2 - pad, 0.12, 0),
      h: new THREE.Vector3(rw / 2 + pad, rh / 2, -rd / 2 - pad * 0.4),
    };

    const maxDim = Math.max(rw, rd, rh, 1);
    const orbit: OrbitState = {
      target: new THREE.Vector3(0, rh * 0.35, 0),
      radius: maxDim * 2.15,
      theta: Math.PI * 0.28,
      phi: Math.PI / 2 - 0.4,
    };
    orbitRef.current = orbit;
    applyOrbitToCamera(camera, orbit);
    readyRef.current = true;
    updateLabelScreenPositions();

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
      gl.endFrameEXP();
      frameSkipRef.current += 1;
      if (frameSkipRef.current % 4 === 0) {
        updateLabelScreenPositions();
      }
    };
    animate();
  };

  return (
    <View
      style={[styles.root, style]}
      {...panResponder.panHandlers}
      collapsable={false}
      onLayout={onLayout}
    >
      <GLView style={styles.gl} onContextCreate={onContextCreate} />

      {labels.map((label) =>
        label.visible ? (
          <View
            key={label.key}
            pointerEvents="none"
            style={[
              styles.dimChip,
              {
                left: label.x,
                top: label.y,
                transform: [{ translateX: -40 }, { translateY: -14 }],
              },
            ]}
          >
            <Text style={styles.dimChipText}>{label.text}</Text>
          </View>
        ) : null
      )}

      <View
        pointerEvents="none"
        style={[styles.hintWrap, { bottom: libraryOpen ? 210 : 36 }]}
      >
        <Text style={styles.hintText}>
          Drag empty space to orbit · Drag a piece to move · Pinch to zoom
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#EDEDF0',
  },
  gl: {
    ...StyleSheet.absoluteFillObject,
  },
  dimChip: {
    position: 'absolute',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(20,28,40,0.12)',
    minWidth: 80,
    alignItems: 'center',
  },
  dimChipText: {
    color: '#1C1B19',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  hintWrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    alignItems: 'center',
  },
  hintText: {
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(20, 28, 40, 0.55)',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
