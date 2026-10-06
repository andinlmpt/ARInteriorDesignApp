/**
 * useLayout3DScene Hook
 * Manages 3D scene state and rendering for layout visualization
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { PanResponder } from 'react-native';
import * as THREE from 'three';
import { ExpoThreeRenderer } from '@/utils/ExpoThreeRenderer';
import { ExpoWebGLRenderingContext } from 'expo-gl';
import type { RoomDimensions, ViewMode, CameraControls, GLLayoutDimensions, Layout3DFurnitureItem } from '@/types/layout-3d';
import type { DesignProposal } from '@/types/ai-design';
import {
  createScene,
  createPerspectiveCamera,
  createOrthographicCamera,
  createLighting,
  createRoom,
  createFurnitureGroup,
  createMeasurementLines,
  highlightFurniture,
  resetFurnitureMaterial,
} from '@/utils/layout3dSceneBuilder';
import { CONTROL_DEFAULTS } from '@/config/layout3d.config';

interface UseLayout3DSceneProps {
  roomDimensions: RoomDimensions;
  design: DesignProposal | null;
  viewMode: ViewMode;
  showGrid: boolean;
  showMeasurements: boolean;
}

interface UseLayout3DSceneReturn {
  // Refs
  sceneRef: React.MutableRefObject<THREE.Scene | null>;
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>;
  rendererRef: React.MutableRefObject<ExpoThreeRenderer | null>;
  controlsRef: React.MutableRefObject<CameraControls>;
  roomGroupRef: React.MutableRefObject<THREE.Group | null>;
  furnitureGroupRef: React.MutableRefObject<THREE.Group | null>;
  measurementGroupRef: React.MutableRefObject<THREE.Group | null>;
  glLayoutRef: React.MutableRefObject<GLLayoutDimensions>;
  raycasterRef: React.MutableRefObject<THREE.Raycaster>;
  // State
  isRendering: boolean;
  furnitureMeshes: Map<string, THREE.Mesh>;
  selectedFurnitureId: string | null;
  // Functions
  onGLContextCreate: (gl: ExpoWebGLRenderingContext) => Promise<void>;
  handleFurnitureTap: (locationX: number, locationY: number, viewWidth?: number, viewHeight?: number) => void;
  selectFurniture: (id: string | null) => void;
  resetCamera: () => void;
  panResponder: ReturnType<typeof PanResponder.create>;
}

export function useLayout3DScene({
  roomDimensions,
  design,
  viewMode,
  showGrid,
  showMeasurements,
}: UseLayout3DSceneProps): UseLayout3DSceneReturn {
  // Scene refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<ExpoThreeRenderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const roomGroupRef = useRef<THREE.Group | null>(null);
  const furnitureGroupRef = useRef<THREE.Group | null>(null);
  const measurementGroupRef = useRef<THREE.Group | null>(null);
  const glLayoutRef = useRef<GLLayoutDimensions>({ width: 0, height: 0 });
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());

  const glRef = useRef<ExpoWebGLRenderingContext | null>(null);
  const fitZoomRef = useRef<number>(CONTROL_DEFAULTS.zoom);
  const latestPropsRef = useRef({ roomDimensions, design, viewMode, showGrid, showMeasurements });
  latestPropsRef.current = { roomDimensions, design, viewMode, showGrid, showMeasurements };

  // Control refs
  const controlsRef = useRef<CameraControls>({ ...CONTROL_DEFAULTS });
  const lastPanRef = useRef<{ x: number; y: number } | null>(null);
  const isPanningRef = useRef(false);
  const isZoomingRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number; distance: number } | null>(null);

  // State
  const [isRendering, setIsRendering] = useState(false);
  const [furnitureMeshes, setFurnitureMeshes] = useState<Map<string, THREE.Mesh>>(new Map());
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);

  // Animation loop
  const animate = useCallback(() => {
    if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;

    try {
      const controls = controlsRef.current;
      
      if (cameraRef.current instanceof THREE.PerspectiveCamera) {
        const radius = controls.zoom;
        const theta = controls.rotationY;
        const phi = controls.rotationX;

        cameraRef.current.position.x = radius * Math.sin(phi) * Math.sin(theta) + controls.panX;
        cameraRef.current.position.y = radius * Math.cos(phi) + controls.panY;
        cameraRef.current.position.z = radius * Math.sin(phi) * Math.cos(theta);

        cameraRef.current.lookAt(controls.panX, 0, controls.panY);
      } else if (cameraRef.current instanceof THREE.OrthographicCamera) {
        cameraRef.current.position.set(controls.panX, 30, controls.panY);
        cameraRef.current.lookAt(controls.panX, 0, controls.panY);
        cameraRef.current.zoom = fitZoomRef.current / Math.max(0.1, controls.zoom);
        cameraRef.current.updateProjectionMatrix();
      }

      rendererRef.current.render(sceneRef.current, cameraRef.current);
      glRef.current?.endFrameEXP();
      animationFrameRef.current = requestAnimationFrame(animate);
    } catch (error) {
      console.error('[Layout3DScene] Animation error:', error);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
  }, []);

  const fitControlsToRoom = useCallback((dimensions: RoomDimensions) => {
    const maxDim = Math.max(dimensions.width, dimensions.length, 1);
    const zoom = Math.min(
      CONTROL_DEFAULTS.maxZoom,
      Math.max(CONTROL_DEFAULTS.minZoom, maxDim * 1.4)
    );
    fitZoomRef.current = zoom;
    controlsRef.current = { ...CONTROL_DEFAULTS, zoom };
  }, []);

  // (Re)build camera, room and furniture from the latest props
  const buildSceneContents = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const { roomDimensions: dims, design: currentDesign, viewMode: mode, showGrid: grid, showMeasurements: measure } =
      latestPropsRef.current;
    const { width, height } = glLayoutRef.current;
    const aspect = height > 0 ? width / height : 1;

    const maxDim = Math.max(dims.width, dims.length, 1);
    cameraRef.current = mode === 'top-down' || mode === 'orthographic'
      ? createOrthographicCamera(aspect, maxDim * 0.65)
      : createPerspectiveCamera(aspect);

    if (roomGroupRef.current) scene.remove(roomGroupRef.current);
    const roomGroup = createRoom(dims, grid);
    roomGroupRef.current = roomGroup;
    scene.add(roomGroup);

    const furnitureGroup = furnitureGroupRef.current;
    const newFurnitureMeshes = new Map<string, THREE.Mesh>();
    if (furnitureGroup) {
      furnitureGroup.clear();
      if (currentDesign?.layout?.furniture) {
        const { meshMap } = createFurnitureGroup(currentDesign.layout.furniture);
        meshMap.forEach((mesh, id) => {
          furnitureGroup.add(mesh);
          newFurnitureMeshes.set(id, mesh);
        });
      }
    }
    setFurnitureMeshes(newFurnitureMeshes);
    setSelectedFurnitureId(null);

    if (measurementGroupRef.current) {
      measurementGroupRef.current.clear();
      if (measure) {
        measurementGroupRef.current.add(createMeasurementLines(dims));
      }
    }
  }, []);

  // Initialize 3D scene
  const onGLContextCreate = useCallback(
    async (gl: ExpoWebGLRenderingContext) => {
      const { drawingBufferWidth, drawingBufferHeight } = gl;
      glRef.current = gl;
      glLayoutRef.current = { width: drawingBufferWidth, height: drawingBufferHeight };

      // Create scene
      const scene = createScene();
      sceneRef.current = scene;

      // Create renderer
      const renderer = new ExpoThreeRenderer({ gl, width: drawingBufferWidth, height: drawingBufferHeight });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      rendererRef.current = renderer;

      // Add lighting
      const lights = createLighting();
      lights.children.forEach(light => scene.add(light));

      const furnitureGroup = new THREE.Group();
      furnitureGroupRef.current = furnitureGroup;
      scene.add(furnitureGroup);

      const measurementGroup = new THREE.Group();
      measurementGroupRef.current = measurementGroup;
      scene.add(measurementGroup);

      fitControlsToRoom(latestPropsRef.current.roomDimensions);
      buildSceneContents();

      setIsRendering(true);
      animate();
    },
    [animate, buildSceneContents, fitControlsToRoom]
  );

  // Rebuild when the design, room, or camera mode changes after the GL context exists
  useEffect(() => {
    if (!sceneRef.current) return;
    buildSceneContents();
  }, [design, roomDimensions, viewMode, showGrid, buildSceneContents]);

  useEffect(() => {
    if (!sceneRef.current) return;
    fitControlsToRoom(roomDimensions);
  }, [roomDimensions, fitControlsToRoom]);

  const selectFurniture = useCallback(
    (id: string | null) => {
      furnitureMeshes.forEach((mesh) => {
        const furniture = design?.layout?.furniture.find((f: any) => f.id === mesh.userData.furnitureId);
        resetFurnitureMaterial(mesh, furniture?.category);
      });
      const mesh = id ? furnitureMeshes.get(id) : undefined;
      if (mesh) highlightFurniture(mesh, true);
      setSelectedFurnitureId(mesh ? id : null);
    },
    [furnitureMeshes, design]
  );

  // Handle furniture tap (location and view size in the same units, e.g. points)
  const handleFurnitureTap = useCallback(
    (locationX: number, locationY: number, viewWidth?: number, viewHeight?: number) => {
      if (!sceneRef.current || !cameraRef.current) return;

      const width = viewWidth ?? glLayoutRef.current.width;
      const height = viewHeight ?? glLayoutRef.current.height;
      if (width === 0 || height === 0) return;

      // Convert screen coordinates to NDC
      const ndc = new THREE.Vector2(
        (locationX / width) * 2 - 1,
        -(locationY / height) * 2 + 1
      );

      raycasterRef.current.setFromCamera(ndc, cameraRef.current);

      // Check intersection with furniture
      const furnitureArray = Array.from(furnitureMeshes.values());
      const intersects = raycasterRef.current.intersectObjects(furnitureArray, true);
      const hit = intersects.find((i) => (i.object as THREE.Mesh).userData.furnitureId);
      selectFurniture(hit ? (hit.object as THREE.Mesh).userData.furnitureId : null);
    },
    [furnitureMeshes, selectFurniture]
  );

  // Reset camera to default position
  const resetCamera = useCallback(() => {
    fitControlsToRoom(latestPropsRef.current.roomDimensions);
  }, [fitControlsToRoom]);

  // Pan responder for touch gestures
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const touches = evt.nativeEvent.touches;
      if (touches.length === 1) {
        isPanningRef.current = true;
        lastPanRef.current = { x: touches[0].pageX, y: touches[0].pageY };
      } else if (touches.length === 2) {
        isZoomingRef.current = true;
        const dx = touches[0].pageX - touches[1].pageX;
        const dy = touches[0].pageY - touches[1].pageY;
        touchStartRef.current = {
          x: (touches[0].pageX + touches[1].pageX) / 2,
          y: (touches[0].pageY + touches[1].pageY) / 2,
          distance: Math.sqrt(dx * dx + dy * dy),
        };
      }
    },
    onPanResponderMove: (evt) => {
      const touches = evt.nativeEvent.touches;
      if (touches.length === 1 && isPanningRef.current && lastPanRef.current) {
        const deltaX = (touches[0].pageX - lastPanRef.current.x) * CONTROL_DEFAULTS.rotationSensitivity;
        const deltaY = (touches[0].pageY - lastPanRef.current.y) * CONTROL_DEFAULTS.rotationSensitivity;

        controlsRef.current.rotationY += deltaX;
        controlsRef.current.rotationX = Math.max(
          CONTROL_DEFAULTS.minRotationX,
          Math.min(CONTROL_DEFAULTS.maxRotationX, controlsRef.current.rotationX + deltaY)
        );

        lastPanRef.current = { x: touches[0].pageX, y: touches[0].pageY };
      } else if (touches.length === 2 && isZoomingRef.current && touchStartRef.current) {
        const dx = touches[0].pageX - touches[1].pageX;
        const dy = touches[0].pageY - touches[1].pageY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const zoomDelta = (touchStartRef.current.distance - distance) * CONTROL_DEFAULTS.zoomSensitivity;

        controlsRef.current.zoom = Math.max(
          CONTROL_DEFAULTS.minZoom,
          Math.min(CONTROL_DEFAULTS.maxZoom, controlsRef.current.zoom + zoomDelta)
        );
        touchStartRef.current.distance = distance;
      }
    },
    onPanResponderRelease: () => {
      isPanningRef.current = false;
      isZoomingRef.current = false;
      lastPanRef.current = null;
      touchStartRef.current = null;
    },
  });

  // Update measurements when toggle changes
  useEffect(() => {
    if (measurementGroupRef.current && sceneRef.current) {
      measurementGroupRef.current.clear();
      if (showMeasurements) {
        const measurements = createMeasurementLines(roomDimensions);
        measurementGroupRef.current.add(measurements);
      }
    }
  }, [showMeasurements, roomDimensions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return {
    sceneRef,
    cameraRef,
    rendererRef,
    controlsRef,
    roomGroupRef,
    furnitureGroupRef,
    measurementGroupRef,
    glLayoutRef,
    raycasterRef,
    isRendering,
    furnitureMeshes,
    selectedFurnitureId,
    onGLContextCreate,
    handleFurnitureTap,
    selectFurniture,
    resetCamera,
    panResponder,
  };
}

