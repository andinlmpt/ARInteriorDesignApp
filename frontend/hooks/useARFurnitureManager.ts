import { useCallback } from 'react';
import * as THREE from 'three';
import * as Haptics from 'expo-haptics';
import { Alert, AccessibilityInfo } from 'react-native';
import { CONFIG } from '../constants/ar-config';
import { getPlacementSafety, checkObstacleCollisions, checkFurnitureCollisions, createFurnitureBoundingBox } from '../utils/arCollisionDetection';
import { suggestAlternativePositions, autoCorrectPosition } from '../utils/arPlacementHelpers';
import { alignToFloor } from '../utils/arPositioningHelpers';
import { disposeObjectRecursive, disposeMesh } from '../utils/three-utils';
import { useARFurnitureState } from './useARFurnitureState';
import { useARInteractionState } from './useARInteractionState';
import { useARUIState } from './useARUIState';
import { useARCoreState } from './useARCoreState';
import { useARRefs } from './useARRefs';
import { createDetailedFurnitureModel } from '../services/FurnitureModelLoader'; // Adjust path if needed


export interface ARFurnitureManagerProps {
  furnitureState: ReturnType<typeof useARFurnitureState>;
  interactionState: ReturnType<typeof useARInteractionState>;
  uiState: ReturnType<typeof useARUIState>;
  coreState: ReturnType<typeof useARCoreState>;
  arRefs: ReturnType<typeof useARRefs>;
  furnitureLibraryById: Record<string, any>;
  saveToHistoryWithSceneCheck: (state: any[]) => void;
  setComponentError: (error: string | null) => void;
  voiceGuidanceEnabled: boolean;
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
}

export function useARFurnitureManager(props: ARFurnitureManagerProps) {
  // Destructure props here in real implementation
  const { furnitureState, interactionState, uiState, coreState, arRefs } = props as any;
  const { selectedLibraryItem, furnitureMapRef, roomData, previewGhostRef, reticleRef, isPlacingFurniture, placementSafety, obstacleMapRef } = props as any;

  const addFurnitureToScene = useCallback(
      async (worldPosition: THREE.Vector3) => {
        if (!selectedLibraryItem || !rootGroupRef.current) {
          return;
        }
  
        setIsPlacingFurniture(true);
        setComponentError(null);
  
        try {
          const libraryItem = furnitureLibraryById[selectedLibraryItem];
          if (!libraryItem) {
            console.error('[ARView] Library item not found:', selectedLibraryItem);
            console.log('[ARView] Available items:', Object.keys(furnitureLibraryById));
            return;
          }
  
          // Verify library item has required properties
          if (!libraryItem.dimensions || !libraryItem.category) {
            console.error('[ARView] Library item missing required properties:', libraryItem);
            return;
          }
  
          console.log('[ARView] Creating furniture model for:', libraryItem.name, 'Category:', libraryItem.category);
  
          // Align position to floor for accurate placement
          let alignedPosition = alignToFloor(worldPosition);
  
          // Pre-check for collisions before placing (optimized)
          let tempBox = createFurnitureBoundingBox(alignedPosition, libraryItem.dimensions);
  
          // Check obstacles first (optimized with early exit, using margin)
          const hasObstacleCollision = checkObstacleCollisions(
            tempBox,
            obstacleMapRef.current,
            CONFIG.COLLISION_MARGIN
          );
  
          // Check existing furniture (optimized with early exit, using margin)
          const hasFurnitureCollision = checkFurnitureCollisions(
            tempBox,
            furnitureMapRef.current,
            undefined,
            CONFIG.COLLISION_MARGIN
          );
  
          // Get enhanced detailed safety information before placement
          let safetyInfo = getPlacementSafety(
            tempBox,
            obstacleMapRef.current,
            furnitureMapRef.current,
            roomData,
            undefined,
            CONFIG.COLLISION_MARGIN
          );
  
          // Enhanced collision response: suggest alternatives or auto-correct
          if (safetyInfo.safetyLevel === 'danger') {
            // Try automatic position correction
            const correctedPosition = autoCorrectPosition(
              alignedPosition,
              libraryItem.dimensions,
              roomData,
              obstacleMapRef.current,
              furnitureMapRef.current
            );
  
            if (correctedPosition) {
              // Auto-correct to safe position
              alignedPosition = correctedPosition;
              tempBox = createFurnitureBoundingBox(correctedPosition, libraryItem.dimensions);
              safetyInfo = getPlacementSafety(
                tempBox,
                obstacleMapRef.current,
                furnitureMapRef.current,
                roomData,
                undefined,
                CONFIG.COLLISION_MARGIN
              );
  
              if (safetyInfo.safetyLevel === 'safe') {
                // Show notification that position was auto-corrected
                Alert.alert(
                  'Position Adjusted',
                  'Furniture position was automatically adjusted to avoid collision.',
                  [{ text: 'OK' }]
                );
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
              }
            } else {
              // Generate suggested positions
              const suggestions = suggestAlternativePositions(
                alignedPosition,
                libraryItem.dimensions,
                roomData,
                obstacleMapRef.current,
                furnitureMapRef.current,
                undefined,
                3
              );
  
              if (suggestions.length > 0) {
                setSuggestedPositions(suggestions);
                Alert.alert(
                  'Collision Detected',
                  `Cannot place here. ${suggestions.length} alternative position(s) suggested. Tap on a suggestion to place there.`,
                  [
                    {
                      text: 'Cancel', style: 'cancel', onPress: () => {
                        setSuggestedPositions([]);
                        // State will be reset in finally block
                      }
                    },
                    ...suggestions.map((pos: THREE.Vector3, idx: number) => ({
                      text: `Use Position ${idx + 1}`,
                      onPress: () => {
                        // Recursively call with suggested position
                        addFurnitureToScene(pos);
                        setSuggestedPositions([]);
                      },
                    })),
                  ]
                );
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { });
                return;
              } else {
                // No suggestions available, show error
                const errorMessage = safetyInfo.reason || 'Cannot place furniture here - collision detected!';
                setComponentError(errorMessage);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
                return;
              }
            }
          }
  
          // Haptic feedback for successful placement
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
            // Haptics not available, ignore
          });
  
          // Screen reader announcement for successful placement with detailed information
          const placementAnnouncement = `Furniture ${libraryItem.name} placed successfully. Safety score: ${safetyInfo.safetyScore} percent. Position: ${alignedPosition.x.toFixed(1)} meters by ${alignedPosition.z.toFixed(1)} meters.`;
          AccessibilityInfo.announceForAccessibility(placementAnnouncement);
  
          // Voice guidance for placement
          if (voiceGuidanceEnabled) {
            const guidanceMessage = `Placed ${libraryItem.name}. Dimensions: ${libraryItem.dimensions.width.toFixed(1)} by ${libraryItem.dimensions.length.toFixed(1)} meters. Safety score: ${safetyInfo.safetyScore} percent.`;
            AccessibilityInfo.announceForAccessibility(guidanceMessage);
          }
  
          const meshId = `${libraryItem.id}-${Date.now()}`;
  
          // Create detailed 3D furniture model (falls back to placeholder if model unavailable)
          console.log('[ARView] Calling createDetailedFurnitureModel for:', libraryItem.name, 'Category:', libraryItem.category);
          const furnitureGroup = await createDetailedFurnitureModel(libraryItem);
          console.log('[ARView] Furniture group created. Children count:', furnitureGroup.children.length);
  
          // Enable shadows on all meshes in the group and ensure visibility
          furnitureGroup.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              child.visible = true; // Ensure all meshes are visible
              // Ensure materials are properly configured
              if (child.material instanceof THREE.MeshStandardMaterial) {
                child.material.needsUpdate = true;
              }
            }
          });
  
          // Ensure the group itself is visible and properly configured
          furnitureGroup.visible = true;
          furnitureGroup.matrixAutoUpdate = true; // Ensure matrix updates automatically
  
          // Force update matrix to ensure proper rendering
          furnitureGroup.updateMatrix();
          furnitureGroup.updateMatrixWorld(true);
  
          // Position the furniture group - ensure it's on the floor
          const finalY = alignedPosition.y + libraryItem.dimensions.height / 2;
          furnitureGroup.position.set(
            alignedPosition.x,
            finalY,
            alignedPosition.z
          );
  
          // Force matrix update to ensure proper rendering
          furnitureGroup.updateMatrix();
          furnitureGroup.updateMatrixWorld(true);
  
          // Debug: Log position and visibility
          console.log(`[ARView] Furniture positioned at:`, {
            x: alignedPosition.x.toFixed(2),
            y: finalY.toFixed(2),
            z: alignedPosition.z.toFixed(2),
            visible: furnitureGroup.visible,
            children: furnitureGroup.children.length,
            name: libraryItem.name
          });
  
          // Use the group directly (not wrapped in an empty mesh)
          // The group itself can be used for collision detection and rendering
  
          // Add ground shadow under furniture for better depth perception
          // Use a more subtle shadow that blends with the floor
          const shadowSize = Math.max(libraryItem.dimensions.width, libraryItem.dimensions.length) * 0.7;
          const shadowGeometry = new THREE.CircleGeometry(shadowSize, 16);
          const shadowMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.2, // Reduced opacity for more subtle shadow
            side: THREE.DoubleSide,
            depthWrite: false, // Prevent z-fighting with floor
          });
          const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
          shadow.rotation.x = -Math.PI / 2;
          shadow.position.y = -libraryItem.dimensions.height / 2 + 0.005; // Slightly lower to avoid z-fighting
          shadow.renderOrder = -1; // Render before furniture to avoid issues
          shadow.visible = true; // Ensure shadow is visible
          furnitureGroup.add(shadow);
  
          // Color-code furniture based on safety level (update materials in group)
          if (safetyInfo.safetyLevel === 'danger') {
            furnitureGroup.traverse((child) => {
              if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
                child.material.color.setHex(0xff0000); // Red for danger
              }
            });
          } else if (safetyInfo.safetyLevel === 'warning') {
            furnitureGroup.traverse((child) => {
              if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
                child.material.color.setHex(0xffaa00); // Yellow for warning
              }
            });
          }
  
          // Calculate physics properties based on furniture dimensions
          const volume = libraryItem.dimensions.width * libraryItem.dimensions.height * libraryItem.dimensions.length;
          const physics: FurniturePhysics = {
            mass: volume * 50, // Mass proportional to volume (kg per cubic meter)
            friction: 0.6, // Standard friction coefficient
            enableGravity: true,
          };
  
          // Position is already set above (line 4947-4951), no need to set again
          // Furniture is already positioned correctly on the floor at finalY
  
          // Store metadata in userData
          furnitureGroup.userData = {
            type: 'furniture',
            id: meshId,
            libraryId: libraryItem.id,
            physics: physics, // Store physics properties
          };
  
          // Frustum culling optimization
          furnitureGroup.frustumCulled = true;
  
          // Store LOD level in userData for dynamic updates (but don't replace geometry)
          const initialDistance = cameraRef.current
            ? alignedPosition.distanceTo(cameraRef.current.position)
            : 5;
          const initialLod = initialDistance > 10 ? 'low' : initialDistance > 5 ? 'medium' : 'high';
          furnitureGroup.userData.lodLevel = initialLod;
  
          // Ensure furniture group is properly configured before adding to scene
          furnitureGroup.updateMatrixWorld(true); // Update matrix to ensure proper rendering
  
          // Add the furniture group directly to the scene
          if (rootGroupRef.current && sceneRef.current) {
            rootGroupRef.current.add(furnitureGroup);
  
            // Force scene update to ensure furniture is rendered
            sceneRef.current.updateMatrixWorld(true);
  
            // Verify furniture is properly added and visible
            console.log(`[ARView] ✓ Placed ${libraryItem.name} at (${alignedPosition.x.toFixed(2)}, ${finalY.toFixed(2)}, ${alignedPosition.z.toFixed(2)})`);
            console.log(`[ARView] ✓ Group has ${furnitureGroup.children.length} children, visible: ${furnitureGroup.visible}`);
            console.log(`[ARView] ✓ Root group children: ${rootGroupRef.current.children.length}, Scene children: ${sceneRef.current.children.length}`);
  
            // Ensure camera can see the furniture (adjust if needed)
            if (cameraRef.current) {
              const distance = furnitureGroup.position.distanceTo(cameraRef.current.position);
              console.log(`[ARView] ✓ Camera distance to furniture: ${distance.toFixed(2)}m`);
  
              // If furniture is too far or camera is not looking at it, log a warning
              if (distance > 20) {
                console.warn(`[ARView] ⚠ Furniture is far from camera (${distance.toFixed(2)}m). May not be visible.`);
              }
            }
          } else {
            console.error('[ARView] ERROR: rootGroupRef.current or sceneRef.current is null!');
            console.error(`[ARView] rootGroupRef: ${!!rootGroupRef.current}, sceneRef: ${!!sceneRef.current}`);
            setIsPlacingFurniture(false);
            setComponentError('Failed to add furniture to scene. Scene not initialized.');
            return;
          }
  
          // ============================================================================
          // CRITICAL: INDIVIDUAL OBJECT STORAGE & SELECTION
          // ============================================================================
          // Each furniture item is stored as an independent, individually selectable entity
          // This ensures:
          // 1. Each object has its own unique ID (meshId)
          // 2. Each object can be individually selected via raycast hit testing
          // 3. Each object maintains its own selection state (userData.isSelected)
          // 4. Each object can be individually manipulated (move, rotate, scale)
          // 5. Each object is rendered independently in the AR scene
          // 6. No group-level selection - only the tapped object is selected
          // 7. Selection does not propagate to parent nodes or other objects
          // ============================================================================
          furnitureMapRef.current.set(meshId, {
            mesh: furnitureGroup, // The furniture group (individual object)
            item: libraryItem,
            libraryId: libraryItem.id,
            // Each furniture item maintains its own independent state
            // No shared parent state, no group-level selection
          });
  
          const newFurniture = {
            id: meshId,
            libraryId: libraryItem.id,
            name: libraryItem.name,
            emoji: libraryItem.emoji || '',
            price: libraryItem.price,
          };
  
          const updatedFurniture = [...placedFurniture, newFurniture];
  
          // Save to history for undo/redo with validation
          saveToHistoryWithSceneCheck(updatedFurniture);
  
          setPlacedFurniture(updatedFurniture);
          setSelectedPlacedId(meshId);
          setSelectedLibraryItem(null);
          setShowPlacementHint(false);
  
          // Update interactive stats with safety score
          const currentSafety = placementSafety.safetyScore;
          setInteractiveStats(prev => {
            const newCount = prev.totalFurniture + 1;
            const newAverageSafety = prev.totalFurniture > 0
              ? ((prev.averageSafety * prev.totalFurniture) + currentSafety) / newCount
              : currentSafety;
            return {
              totalFurniture: newCount,
              totalArea: prev.totalArea + (libraryItem.dimensions.width * libraryItem.dimensions.length),
              averageSafety: newAverageSafety,
              placementCount: prev.placementCount + 1,
            };
          });
  
          // Highlight newly placed furniture with animation
          setHighlightedFurniture(meshId);
          if (highlightTimeoutRef.current) {
            clearTimeout(highlightTimeoutRef.current);
          }
          highlightTimeoutRef.current = setTimeout(() => {
            setHighlightedFurniture(null);
          }, CONFIG.INTERACTIVE_HIGHLIGHT_DURATION);
  
          // Furniture is already positioned correctly on the floor
          // Add a subtle scale animation for visual feedback (like in the reference image)
          const placedMesh = furnitureMapRef.current.get(meshId)?.mesh;
          if (placedMesh) {
            // Subtle pop-in animation for better UX (like in the reference image)
            placedMesh.scale.set(0.9, 0.9, 0.9);
  
            let scale = 0.9;
            const scaleInterval = setInterval(() => {
              scale += 0.02; // Smooth scale up
              if (scale >= 1.0) {
                scale = 1.0;
                clearInterval(scaleInterval);
              }
              placedMesh.scale.set(scale, scale, scale);
            }, 16); // ~60fps
  
            // Cleanup after animation completes (safety timeout)
            setTimeout(() => {
              clearInterval(scaleInterval);
              placedMesh.scale.set(1.0, 1.0, 1.0); // Ensure final scale is correct
            }, 1000);
          }
  
          // Remove and dispose preview ghost completely after placing furniture
          if (previewGhostRef.current && rootGroupRef.current) {
            rootGroupRef.current.remove(previewGhostRef.current);
            disposeObjectRecursive(previewGhostRef.current);
            previewGhostRef.current = null;
          }
  
          // Hide reticle after placing furniture
          if (reticleRef.current) {
            reticleRef.current.visible = false;
          }
          reticleWorldPositionRef.current = null;
          if (reticleSmoothedPositionRef.current) {
            reticleSmoothedPositionRef.current = null;
          }
  
          // Final verification that furniture is in the scene (after a short delay to ensure it's added)
          setTimeout(() => {
            const entry = furnitureMapRef.current.get(meshId);
            if (entry && entry.mesh) {
              const isInScene = rootGroupRef.current?.children.includes(entry.mesh) || false;
              console.log(`[ARView] ✓ Verification: Furniture "${libraryItem.name}" ${isInScene ? 'IS' : 'IS NOT'} in scene`);
              if (!isInScene) {
                console.error(`[ARView] ERROR: Furniture ${meshId} was not properly added to scene!`);
                // Try to re-add it
                if (rootGroupRef.current && entry.mesh) {
                  rootGroupRef.current.add(entry.mesh);
                  entry.mesh.updateMatrixWorld(true);
                  console.log(`[ARView] ✓ Re-added furniture to scene`);
                }
              } else {
                // Verify visibility
                entry.mesh.traverse((child) => {
                  if (child instanceof THREE.Mesh) {
                    console.log(`[ARView] ✓ Child mesh visible: ${child.visible}, material: ${child.material ? 'present' : 'missing'}`);
                  }
                });
              }
            }
  
            // Check for collisions after verification
            if (entry && entry.mesh) {
              checkCollisions(entry.mesh, meshId);
            }
          }, 100);
        } catch (error) {
          console.error('[ARView] Error placing furniture:', error);
          setComponentError(ERROR_MESSAGES.FURNITURE_PLACEMENT_ERROR);
          Alert.alert('Placement Error', ERROR_MESSAGES.FURNITURE_PLACEMENT_ERROR, [
            { text: 'OK', style: 'default' }
          ]);
        } finally {
          setIsPlacingFurniture(false);
        }
      },
      [selectedLibraryItem, furnitureLibraryById, placedFurniture, saveToHistoryWithSceneCheck, checkCollisions],
    );

  const checkCollisions = useCallback((newMesh: THREE.Mesh | THREE.Group, newId: string) => {
      // Throttle collision checks for performance
      const now = Date.now();
      if (now - lastCollisionCheckRef.current < COLLISION_CHECK_THROTTLE) {
        return; // Skip this check, too soon since last one
      }
      lastCollisionCheckRef.current = now;
  
      const warnings = new Set<string>();
      const newBox = new THREE.Box3().setFromObject(newMesh);
  
      // Check collisions with other furniture (optimized, using margin)
      const hasFurnitureCollision = checkFurnitureCollisions(
        newBox,
        furnitureMapRef.current,
        newId,
        CONFIG.COLLISION_MARGIN
      );
      if (hasFurnitureCollision) {
        warnings.add(newId);
  
        // Visual feedback: make colliding mesh pulse red
        if (newMesh instanceof THREE.Mesh) {
          const newMaterial = newMesh.material instanceof THREE.MeshStandardMaterial
            ? newMesh.material
            : Array.isArray(newMesh.material) && newMesh.material[0] instanceof THREE.MeshStandardMaterial
              ? newMesh.material[0]
              : null;
          if (newMaterial && newMaterial.color) {
            const originalColor = newMaterial.color.clone();
            newMaterial.color.setHex(0xff0000);
            setTimeout(() => {
              if (newMaterial && newMaterial.color) {
                newMaterial.color.copy(originalColor);
              }
            }, 1000);
          }
        } else if (newMesh instanceof THREE.Group) {
          // Handle Group meshes
          newMesh.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
              const originalColor = child.material.color.clone();
              child.material.color.setHex(0xff0000);
              setTimeout(() => {
                if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
                  child.material.color.copy(originalColor);
                }
              }, 1000);
            }
          });
        }
      }
  
      // Check collisions with obstacles - CRITICAL for accurate detection (optimized, using margin)
      const hasObstacleCollision = checkObstacleCollisions(
        newBox,
        obstacleMapRef.current,
        CONFIG.COLLISION_MARGIN
      );
      if (hasObstacleCollision) {
        warnings.add(newId);
  
        // Visual feedback: make colliding furniture pulse red
        // Visual feedback: make colliding furniture pulse red
        if (newMesh instanceof THREE.Mesh) {
          const newMaterial = newMesh.material as THREE.MeshStandardMaterial;
          if (newMaterial && !Array.isArray(newMaterial) && newMaterial.color) {
            const originalColor = newMaterial.color.clone();
            newMaterial.color.setHex(0xff0000);
            setTimeout(() => {
              if (newMaterial) {
                newMaterial.color.copy(originalColor);
              }
            }, 1000);
          }
        }
  
        // Highlight obstacles that are being collided with
        obstacleMapRef.current.forEach((obstacleMesh) => {
          const obstacleBox = new THREE.Box3().setFromObject(obstacleMesh);
          if (newBox.intersectsBox(obstacleBox)) {
            const obstacleMaterial = obstacleMesh.material as THREE.MeshStandardMaterial;
            if (obstacleMaterial) {
              const obstacleOriginalColor = obstacleMaterial.color.clone();
              obstacleMaterial.color.setHex(0xff6600); // Orange warning color
              obstacleMaterial.opacity = 1.0;
              setTimeout(() => {
                if (obstacleMaterial) {
                  obstacleMaterial.color.copy(obstacleOriginalColor);
                  obstacleMaterial.opacity = 0.85;
                }
              }, 1500);
            }
          }
        });
      }
  
      if (warnings.size > 0) {
        setCollisionWarnings(warnings);
        setTimeout(() => setCollisionWarnings(new Set()), CONFIG.COLLISION_WARNING_TIMEOUT);
        // Haptic feedback for collision
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {
          // Haptics not available, ignore
        });
      }
    }, []);

  const resetFurnitureMeshes = useCallback(() => {
      furnitureMapRef.current.forEach(({ mesh }) => {
        rootGroupRef.current?.remove(mesh);
  
        // Dispose of all geometries and materials in the group
        // Groups contain children (meshes) that have geometry and material
        if (mesh instanceof THREE.Mesh) {
          // Handle Mesh objects directly
          if (mesh.geometry) {
            mesh.geometry.dispose();
          }
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((mat: THREE.Material) => mat.dispose());
            } else {
              mesh.material.dispose();
            }
          }
        } else if (mesh instanceof THREE.Group) {
          // Handle Group objects by traversing children
          mesh.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh) {
              if (child.geometry) {
                child.geometry.dispose();
              }
              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach((mat: THREE.Material) => mat.dispose());
                } else {
                  child.material.dispose();
                }
              }
            }
          });
        } else {
          // Handle other Object3D types using disposeMesh helper
          // This ensures all types are properly disposed
          disposeMesh(mesh);
        }
      });
      furnitureMapRef.current.clear();
  
      // Clear preview ghost
      if (previewGhostRef.current) {
        rootGroupRef.current?.remove(previewGhostRef.current);
        disposeObjectRecursive(previewGhostRef.current);
        previewGhostRef.current = null;
      }
  
      // Clean up caches after clearing furniture
      cleanupCaches();
  
      setPlacedFurniture([]);
      setSelectedPlacedId(null);
      clearHistory();
      setCollisionWarnings(new Set());
    }, [cleanupCaches]);

  const removeFurniture = useCallback((id: string) => {
      const entry = furnitureMapRef.current.get(id);
      if (!entry) {
        return;
      }
      const furnitureName = entry.item.name;
      rootGroupRef.current?.remove(entry.mesh);
      if (entry.mesh instanceof THREE.Group) {
        disposeObjectRecursive(entry.mesh);
      } else {
        disposeMesh(entry.mesh);
      }
      furnitureMapRef.current.delete(id);
      const updated = placedFurniture.filter((item) => item.id !== id);
  
      // Accessibility announcement for furniture removal
      AccessibilityInfo.announceForAccessibility(
        `Removed ${furnitureName} from scene. ${updated.length} furniture item${updated.length !== 1 ? 's' : ''} remaining.`
      );
  
      // Save to history with validation to prevent corruption
      saveToHistoryWithSceneCheck(updated);
  
      setPlacedFurniture(updated);
      if (selectedPlacedId === id) {
        setSelectedPlacedId(null);
      }
    }, [selectedPlacedId, placedFurniture, saveToHistoryWithSceneCheck]);

  const restoreFurnitureState = useCallback((state: PlacedFurnitureMeta[]) => {
      if (!rootGroupRef.current) return;
  
      // Validate state before restoring to prevent corruption
      // Don't check scene presence during restoration since we're about to restore the furniture
      const validatedState = validateHistoryState(state, false);
  
      // Warn if validation removed items
      if (validatedState.length !== state.length) {
        console.warn(`[ARView] History restoration: Removed ${state.length - validatedState.length} invalid items from restored state.`);
      }
  
      // Remove all current furniture
      furnitureMapRef.current.forEach(({ mesh }) => {
        rootGroupRef.current?.remove(mesh);
        if (mesh instanceof THREE.Group) {
          disposeObjectRecursive(mesh);
        } else {
          disposeMesh(mesh);
        }
      });
      furnitureMapRef.current.clear();
  
      // Restore validated state (not the original potentially corrupted state)
      if (validatedState && validatedState.length > 0) {
        validatedState.forEach((item) => {
          const libraryItem = furnitureLibraryById[item.libraryId];
          if (libraryItem && rootGroupRef.current) {
            // Enhanced geometry for restored furniture
            const widthSegs = Math.max(2, Math.floor(libraryItem.dimensions.width * 2));
            const heightSegs = Math.max(2, Math.floor(libraryItem.dimensions.height * 2));
            const depthSegs = Math.max(2, Math.floor(libraryItem.dimensions.length * 2));
            const geometry = new THREE.BoxGeometry(
              libraryItem.dimensions.width,
              libraryItem.dimensions.height,
              libraryItem.dimensions.length,
              widthSegs,
              heightSegs,
              depthSegs,
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
          }
        });
      }
    }, [furnitureLibraryById, validateHistoryState]);

  const nudgeSelectedFurniture = useCallback(
      (axis: 'x' | 'z', delta: number) => {
        if (!selectedPlacedId) {
          return;
        }
        const entry = furnitureMapRef.current.get(selectedPlacedId);
        if (!entry) {
          return;
        }
        entry.mesh.position[axis] += delta;
      },
      [selectedPlacedId],
    );

  const _duplicateFurniture = useCallback(() => {
      if (!selectedPlacedId) {
        return;
      }
      const entry = furnitureMapRef.current.get(selectedPlacedId);
      if (!entry || !rootGroupRef.current) {
        return;
      }
  
      // Get current position and offset slightly
      if (!entry.mesh.position) return;
      const currentPos = entry.mesh.position.clone();
      const offset = new THREE.Vector3(0.3, 0, 0.3); // Offset by 30cm diagonally
      const newPosition = currentPos.clone().add(offset);
      const alignedPosition = alignToFloor(newPosition);
  
      const libraryItem = entry.item;
      if (!libraryItem) return;
  
      // Create new furniture mesh
      const widthSegs = Math.max(2, Math.floor(libraryItem.dimensions.width * 2));
      const heightSegs = Math.max(2, Math.floor(libraryItem.dimensions.height * 2));
      const depthSegs = Math.max(2, Math.floor(libraryItem.dimensions.length * 2));
      const geometry = new THREE.BoxGeometry(
        libraryItem.dimensions.width,
        libraryItem.dimensions.height,
        libraryItem.dimensions.length,
        widthSegs,
        heightSegs,
        depthSegs,
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
      });
      const newMesh = new THREE.Mesh(geometry, material);
      newMesh.castShadow = true;
      newMesh.receiveShadow = true;
      newMesh.position.copy(alignedPosition);
      newMesh.rotation.y = entry.mesh.rotation.y;
  
      const meshId = `furniture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      newMesh.userData = {
        type: 'furniture',
        id: meshId,
        libraryId: libraryItem.id,
      };
  
      rootGroupRef.current.add(newMesh);
      furnitureMapRef.current.set(meshId, {
        mesh: newMesh,
        item: libraryItem,
        libraryId: libraryItem.id,
      });
  
      const newFurniture = {
        id: meshId,
        libraryId: libraryItem.id,
        name: libraryItem.name,
        emoji: libraryItem.emoji || '',
        price: libraryItem.price,
      };
  
      const updatedFurniture = [...placedFurniture, newFurniture];
      saveToHistoryWithSceneCheck(updatedFurniture);
      setPlacedFurniture(updatedFurniture);
      setSelectedPlacedId(meshId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
    }, [selectedPlacedId, placedFurniture, saveToHistoryWithSceneCheck, alignToFloor]);

  const _swapFurniture = useCallback((newLibraryId: string) => {
      if (!selectedPlacedId) {
        return;
      }
      const entry = furnitureMapRef.current.get(selectedPlacedId);
      if (!entry || !rootGroupRef.current) {
        return;
      }
  
      const libraryItem = furnitureLibraryById[newLibraryId];
      if (!libraryItem) {
        return;
      }
  
      // Store current position and rotation
      if (!entry.mesh.position) return;
      const currentPosition = entry.mesh.position.clone();
      const currentRotation = entry.mesh.rotation.y;
  
      // Remove old mesh
      rootGroupRef.current.remove(entry.mesh);
      if (entry.mesh instanceof THREE.Group) {
        disposeObjectRecursive(entry.mesh);
      } else {
        disposeMesh(entry.mesh);
      }
  
      // Create new mesh with same position/rotation
      const widthSegs = Math.max(2, Math.floor(libraryItem.dimensions.width * 2));
      const heightSegs = Math.max(2, Math.floor(libraryItem.dimensions.height * 2));
      const depthSegs = Math.max(2, Math.floor(libraryItem.dimensions.length * 2));
      const geometry = new THREE.BoxGeometry(
        libraryItem.dimensions.width,
        libraryItem.dimensions.height,
        libraryItem.dimensions.length,
        widthSegs,
        heightSegs,
        depthSegs,
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
      });
      const newMesh = new THREE.Mesh(geometry, material);
      newMesh.castShadow = true;
      newMesh.receiveShadow = true;
      newMesh.position.copy(currentPosition);
      newMesh.rotation.y = currentRotation;
      newMesh.userData = {
        type: 'furniture',
        id: selectedPlacedId,
        libraryId: newLibraryId,
      };
  
      rootGroupRef.current.add(newMesh);
      furnitureMapRef.current.set(selectedPlacedId, {
        mesh: newMesh,
        item: libraryItem,
        libraryId: newLibraryId,
      });
  
      // Update furniture list
      const updated = placedFurniture.map(item =>
        item.id === selectedPlacedId
          ? { ...item, libraryId: newLibraryId, name: libraryItem.name, emoji: libraryItem.emoji || '', price: libraryItem.price }
          : item
      );
      saveToHistoryWithSceneCheck(updated);
      setPlacedFurniture(updated);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
    }, [selectedPlacedId, furnitureLibraryById, placedFurniture, saveToHistoryWithSceneCheck]);

  const _clearFurniture = useCallback(() => {
      resetFurnitureMeshes();
    }, [resetFurnitureMeshes]);

  return {
    addFurnitureToScene,
    checkCollisions,
    resetFurnitureMeshes,
    removeFurniture,
    restoreFurnitureState,
    nudgeSelectedFurniture,
    _duplicateFurniture,
    _swapFurniture,
    _clearFurniture,
  };
}
