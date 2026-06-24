import { useCallback } from 'react';
import * as THREE from 'three';
import { useARCoreState } from './useARCoreState';
import { useARRefs } from './useARRefs';


export interface ARDemoManagerProps {
  coreState: ReturnType<typeof useARCoreState>;
  arRefs: ReturnType<typeof useARRefs>;
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  sceneRef: React.MutableRefObject<THREE.Scene | null>;
  restoreFurnitureState: (state: any[]) => void;
  setDemoStep: (step: number) => void;
  setDemoTourActive: (active: boolean) => void;
}

export function useARDemoManager(props: ARDemoManagerProps) {
  // Destructure props here in real implementation
  const { furnitureState, interactionState, uiState, coreState, arRefs } = props as any;
  const { selectedLibraryItem, furnitureMapRef, roomData, previewGhostRef, reticleRef, isPlacingFurniture, placementSafety, obstacleMapRef } = props as any;

  const _startDemoMode = useCallback(() => {
      if (!roomData || !rendererReady) {
        Alert.alert('Demo Mode', 'Please wait for AR to initialize and room data to load.');
        return;
      }
  
      setDemoMode(true);
      _setDemoStep(0);
      _setDemoTourActive(true);
  
      // Clear existing furniture for clean demo
      placedFurniture.forEach(item => {
        const entry = furnitureMapRef.current.get(item.id);
        if (entry && rootGroupRef.current) {
          rootGroupRef.current.remove(entry.mesh);
          if (entry.mesh instanceof THREE.Group) {
            disposeObjectRecursive(entry.mesh);
          } else {
            disposeMesh(entry.mesh);
          }
        }
      });
      furnitureMapRef.current.clear();
      setPlacedFurniture([]);
  
      // Start guided tour
      let currentStep = 0;
      const showTourStep = () => {
        if (currentStep < DEMO_TOUR_STEPS.length) {
          const step = DEMO_TOUR_STEPS[currentStep];
          _setDemoStep(currentStep);
          setComponentError(null);
  
          // Show step message
          Alert.alert(
            step.title,
            step.description,
            [{
              text: 'Next', onPress: () => {
                currentStep++;
                if (currentStep < DEMO_TOUR_STEPS.length) {
                  demoTimeoutRef.current = setTimeout(showTourStep, 500);
                } else {
                  // After tour, load preset
                  loadDemoPreset(0);
                }
              }
            }]
          );
        }
      };
  
      showTourStep();
    }, [roomData, rendererReady, placedFurniture]);

  const loadDemoPreset = useCallback((presetIndex: number) => {
      if (presetIndex >= DEMO_PRESETS.length) {
        setDemoMode(false);
        _setDemoTourActive(false);
        return;
      }
  
      const preset = DEMO_PRESETS[presetIndex];
      setComponentError(null);
  
      // Place furniture from preset with delays for visual effect
      preset.furniture.forEach((item, index) => {
        setTimeout(() => {
          const libraryItem = furnitureLibraryById[item.id];
          if (!libraryItem || !roomData) return;
  
          const worldPosition = new THREE.Vector3(
            item.position.x,
            0,
            item.position.z
          );
  
          // Create furniture mesh
          const widthSegs = Math.max(2, Math.floor(libraryItem.dimensions.width * 2));
          const heightSegs = Math.max(2, Math.floor(libraryItem.dimensions.height * 2));
          const depthSegs = Math.max(2, Math.floor(libraryItem.dimensions.length * 2));
  
          const geometry = new THREE.BoxGeometry(
            libraryItem.dimensions.width,
            libraryItem.dimensions.height,
            libraryItem.dimensions.length,
            widthSegs,
            heightSegs,
            depthSegs
          );
  
          const material = new THREE.MeshStandardMaterial({
            color: libraryItem.color,
            metalness: 0.3,
            roughness: 0.7,
            envMapIntensity: 0.5,
          });
  
          const mesh = new THREE.Mesh(geometry, material);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.position.set(
            worldPosition.x,
            worldPosition.y + libraryItem.dimensions.height / 2,
            worldPosition.z
          );
          mesh.rotation.y = item.rotation;
  
          if (rootGroupRef.current) {
            rootGroupRef.current.add(mesh);
          }
  
          const furnitureId = `demo-${item.id}-${Date.now()}-${index}`;
          furnitureMapRef.current.set(furnitureId, {
            mesh,
            item: libraryItem,
            libraryId: item.id,
          });
  
          const newFurniture: PlacedFurnitureMeta = {
            id: furnitureId,
            libraryId: item.id,
            name: libraryItem.name,
            emoji: libraryItem.emoji || '',
            price: libraryItem.price,
          };
  
          setPlacedFurniture(prev => [...prev, newFurniture]);
  
          // Highlight furniture with animation
          setHighlightedFurniture(furnitureId);
          if (highlightTimeoutRef.current) {
            clearTimeout(highlightTimeoutRef.current);
          }
          highlightTimeoutRef.current = setTimeout(() => {
            setHighlightedFurniture(null);
          }, CONFIG.INTERACTIVE_HIGHLIGHT_DURATION);
  
          // Haptic feedback
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        }, index * 800); // Stagger placement for visual effect
      });
  
      // Auto-advance to next preset after delay
      demoTimeoutRef.current = setTimeout(() => {
        if (presetIndex < DEMO_PRESETS.length - 1) {
          // Clear current preset
          placedFurniture.forEach(item => {
            const entry = furnitureMapRef.current.get(item.id);
            if (entry && rootGroupRef.current) {
              rootGroupRef.current.remove(entry.mesh);
              if (entry.mesh instanceof THREE.Group) {
                disposeObjectRecursive(entry.mesh);
              } else {
                disposeMesh(entry.mesh);
              }
            }
          });
          furnitureMapRef.current.clear();
          setPlacedFurniture([]);
  
          // Load next preset
          setTimeout(() => loadDemoPreset(presetIndex + 1), 1000);
        } else {
          setDemoMode(false);
          _setDemoTourActive(false);
          Alert.alert('Demo Complete', 'You can now interact with the furniture or start a new demo.');
        }
      }, preset.furniture.length * 800 + 3000);
    }, [roomData, furnitureLibraryById, placedFurniture]);

  const _stopDemoMode = useCallback(() => {
      setDemoMode(false);
      _setDemoTourActive(false);
      _setDemoStep(0);
  
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
      if (demoTimeoutRef.current) {
        clearTimeout(demoTimeoutRef.current);
        demoTimeoutRef.current = null;
      }
    }, []);

  return {
    _startDemoMode,
    loadDemoPreset,
    _stopDemoMode,
  };
}
