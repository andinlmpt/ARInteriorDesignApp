import { useCallback } from 'react';
import * as THREE from 'three';
import { useARFurnitureState } from './useARFurnitureState';
import { useARInteractionState } from './useARInteractionState';
import { useARCoreState } from './useARCoreState';
import { useARRefs } from './useARRefs';


export interface ARLayoutManagerProps {
  furnitureState: ReturnType<typeof useARFurnitureState>;
  interactionState: ReturnType<typeof useARInteractionState>;
  coreState: ReturnType<typeof useARCoreState>;
  arRefs: ReturnType<typeof useARRefs>;
  setLayoutName: (name: string) => void;
  setShowSaveLayoutModal: (show: boolean) => void;
  setComponentError: (error: string | null) => void;
  clearHistory: () => void;
  restoreFurnitureState: (state: any[]) => void;
  furnitureLibraryById: Record<string, any>;
  voiceGuidanceEnabled: boolean;
}

export function useARLayoutManager(props: ARLayoutManagerProps) {
  // Destructure props here in real implementation
  const { furnitureState, interactionState, uiState, coreState, arRefs } = props as any;
  const { selectedLibraryItem, furnitureMapRef, roomData, previewGhostRef, reticleRef, isPlacingFurniture, placementSafety, obstacleMapRef } = props as any;

  const _saveCurrentLayout = useCallback(async (name?: string, silent: boolean = false) => {
      if (placedFurniture.length === 0 && !silent) {
        Alert.alert('No Furniture', 'Please place some furniture before saving.');
        return;
      }
  
      // For auto-save (silent), we still want to persist the empty state if it was cleared
      // but the layout definition expects furniture. So we allow empty furniture array.
  
      const layoutName = name || `Layout ${new Date().toLocaleString()}`;
      const layout: SavedLayout = {
        id: `layout-${Date.now()}`,
        name: layoutName,
        timestamp: Date.now(),
        roomData,
        furniture: Array.from(furnitureMapRef.current.entries()).map(([id, entry]) => ({
          id,
          libraryId: entry.libraryId,
          position: {
            x: entry.mesh.position.x,
            y: entry.mesh.position.y - entry.item.dimensions.height / 2,
            z: entry.mesh.position.z,
          },
          rotation: {
            x: entry.mesh.rotation.x,
            y: entry.mesh.rotation.y,
            z: entry.mesh.rotation.z,
          },
        })),
        metadata: {
          totalFurniture: interactiveStats.totalFurniture,
          totalArea: interactiveStats.totalArea,
          averageSafety: interactiveStats.averageSafety,
        },
      };
  
      try {
        if (!silent) {
          const savedLayouts = await getJson<SavedLayout[]>(STORAGE_KEY, []);
          savedLayouts.push(layout);
          // Keep only last 20 layouts
          const recentLayouts = savedLayouts.slice(-20);
          await setJson(STORAGE_KEY, recentLayouts);
        }
  
        await setJson(CURRENT_LAYOUT_KEY, layout);
  
        if (!silent) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
          Alert.alert('Saved', `Layout "${layoutName}" has been saved successfully.`);
        }
      } catch (error) {
        console.error('[ARView] Save error:', error);
        if (!silent) Alert.alert('Save Failed', 'Unable to save layout. Please try again.');
      }
    }, [placedFurniture, roomData, interactiveStats]);

  const _loadSavedLayout = useCallback(async (layout: SavedLayout, silent: boolean = false) => {
      if (!rootGroupRef.current || !roomData) {
        if (!silent) Alert.alert('Error', 'AR must be initialized before loading a layout.');
        return;
      }
  
      // Clear existing furniture
      resetFurnitureMeshes();
      setPlacedFurniture([]);
      setSelectedPlacedId(null);
      setSelectedFurnitureIds(new Set());
  
      // Load furniture from layout
      const loadedFurniture: PlacedFurnitureMeta[] = [];
  
      for (const item of layout.furniture) {
        const libraryItem = furnitureLibraryById[item.libraryId];
        if (!libraryItem) continue;
  
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
  
        const colorValue = libraryItem.color || '#808080';
        const baseColor = new THREE.Color(colorValue);
        // Validate color was created successfully
        if (!baseColor || !baseColor.isColor) {
          baseColor.setHex(0x808080);
        }
        const material = new THREE.MeshStandardMaterial({
          color: baseColor,
          roughness: 0.6,
          metalness: 0.2,
          envMapIntensity: 0.5,
          emissive: baseColor.clone().multiplyScalar(0.05),
        });
  
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.set(
          item.position.x,
          item.position.y + libraryItem.dimensions.height / 2,
          item.position.z
        );
        mesh.rotation.set(
          item.rotation.x || 0,
          item.rotation.y || 0,
          item.rotation.z || 0
        );
        mesh.userData = {
          type: 'furniture',
          id: item.id,
          libraryId: item.libraryId,
        };
  
        rootGroupRef.current.add(mesh);
        furnitureMapRef.current.set(item.id, {
          mesh,
          item: libraryItem,
          libraryId: item.libraryId,
        });
  
        loadedFurniture.push({
          id: item.id,
          libraryId: item.libraryId,
          name: libraryItem.name,
          emoji: libraryItem.emoji || '',
          price: libraryItem.price,
        });
      }
  
      setPlacedFurniture(loadedFurniture);
      if (layout.metadata) {
        setInteractiveStats({
          totalFurniture: layout.metadata.totalFurniture,
          totalArea: layout.metadata.totalArea,
          averageSafety: layout.metadata.averageSafety,
          placementCount: layout.metadata.totalFurniture,
        });
      }
  
      if (!silent) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
        Alert.alert('Loaded', `Layout "${layout.name}" has been loaded successfully.`);
      }
    }, [roomData, furnitureLibraryById, resetFurnitureMeshes]);

  const _exportLayout = useCallback(async () => {
      if (placedFurniture.length === 0) {
        Alert.alert('No Furniture', 'Please place some furniture before exporting.');
        return;
      }
  
      const exportData: SavedLayout = {
        id: `export-${Date.now()}`,
        name: `Exported Layout ${new Date().toLocaleString()}`,
        timestamp: Date.now(),
        roomData,
        furniture: Array.from(furnitureMapRef.current.entries()).map(([id, entry]) => ({
          id,
          libraryId: entry.libraryId,
          position: {
            x: entry.mesh.position.x,
            y: entry.mesh.position.y - entry.item.dimensions.height / 2,
            z: entry.mesh.position.z,
          },
          rotation: {
            x: entry.mesh.rotation.x,
            y: entry.mesh.rotation.y,
            z: entry.mesh.rotation.z,
          },
        })),
        metadata: {
          totalFurniture: interactiveStats.totalFurniture,
          totalArea: interactiveStats.totalArea,
          averageSafety: interactiveStats.averageSafety,
        },
      };
  
      try {
        const jsonString = JSON.stringify(exportData, null, 2);
  
        if (Platform.OS === 'web' && typeof document !== 'undefined' && typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
          // Web: Download as file (only if running in web environment)
          try {
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `ar-layout-${Date.now()}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          } catch (error) {
            console.warn('[ARView] Web export failed, falling back to share:', error);
            // Fall through to Share API
          }
        }
  
        // Mobile or web fallback: Use Share API
        if (Platform.OS !== 'web' || (Platform.OS === 'web' && typeof Share !== 'undefined')) {
          await Share.share({
            message: jsonString,
            title: 'AR Layout Export',
          });
        }
  
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
      } catch (error) {
        console.error('[ARView] Export error:', error);
        Alert.alert('Export Failed', 'Unable to export layout. Please try again.');
      }
    }, [placedFurniture, roomData, interactiveStats]);

  return {
    _saveCurrentLayout,
    _loadSavedLayout,
    _exportLayout,
  };
}
