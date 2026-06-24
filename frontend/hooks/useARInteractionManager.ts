import { useCallback } from 'react';
import * as THREE from 'three';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';
import { CONFIG } from '../constants/ar-config';
import { useARFurnitureState } from './useARFurnitureState';
import { useARInteractionState } from './useARInteractionState';
import { useARUIState } from './useARUIState';
import { useARCoreState } from './useARCoreState';
import { useARRefs } from './useARRefs';


export interface ARInteractionManagerProps {
  furnitureState: ReturnType<typeof useARFurnitureState>;
  interactionState: ReturnType<typeof useARInteractionState>;
  uiState: ReturnType<typeof useARUIState>;
  coreState: ReturnType<typeof useARCoreState>;
  arRefs: ReturnType<typeof useARRefs>;
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  sceneRef: React.MutableRefObject<THREE.Scene | null>;
  reticleWorldPositionRef: React.MutableRefObject<THREE.Vector3 | null>;
  findCornerSnapTargets: any;
  findEdgeAlignmentTargets: any;
  detectFurnitureAtScreenPoint: any;
  showTooltip: any;
}

export function useARInteractionManager(props: ARInteractionManagerProps) {
  // Destructure props here in real implementation
  const { furnitureState, interactionState, uiState, coreState, arRefs } = props as any;
  const { selectedLibraryItem, furnitureMapRef, roomData, previewGhostRef, reticleRef, isPlacingFurniture, placementSafety, obstacleMapRef } = props as any;

  const handleSceneTap = useCallback(
      (event: GestureResponderEvent) => {
        if (!rendererReady || !cameraRef.current) {
          return;
        }
  
        const { locationX, locationY } = event.nativeEvent;
  
        // Handle measurement mode
        if (measurementMode) {
          const { width, height } = glLayoutRef.current;
          if (width === 0 || height === 0) return;
  
          const ndc = new THREE.Vector2(
            (locationX / width) * 2 - 1,
            -(locationY / height) * 2 + 1,
          );
  
          if (!raycasterRef.current) return;
  
          raycasterRef.current.setFromCamera(ndc, cameraRef.current);
  
          // Raycast to floor plane (y = 0)
          const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
          const intersectPoint = new THREE.Vector3();
          raycasterRef.current.ray.intersectPlane(plane, intersectPoint);
  
          if (measurementMode === 'distance') {
            if (measurementPoints.length === 0) {
              setMeasurementPoints([intersectPoint]);
              setMeasurementResults(null);
            } else if (measurementPoints.length === 1) {
              const newPoints = [...measurementPoints, intersectPoint];
              setMeasurementPoints(newPoints);
              const distance = calculateDistance(measurementPoints[0], intersectPoint);
              setMeasurementResults({ distance });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
            } else {
              // Reset for new measurement
              setMeasurementPoints([intersectPoint]);
              setMeasurementResults(null);
            }
          } else if (measurementMode === 'area') {
            const newPoints = [...measurementPoints, intersectPoint];
            setMeasurementPoints(newPoints);
            if (newPoints.length >= 3) {
              const area = calculateArea(newPoints);
              setMeasurementResults({ area });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
            }
          } else if (measurementMode === 'volume') {
            const newPoints = [...measurementPoints, intersectPoint];
            setMeasurementPoints(newPoints);
            if (newPoints.length >= 3) {
              // For volume, we need height - use average height of room or default
              const height = roomData?.dimensions.height || 2.7;
              const area = calculateArea(newPoints);
              const volume = calculateVolume(newPoints, height);
              setMeasurementResults({ area, volume });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
            }
          }
          return;
        }
  
        // Check if user tapped on existing furniture
        const tappedFurnitureId = detectFurnitureAtScreenPoint(locationX, locationY);
  
        if (tappedFurnitureId) {
          const entry = furnitureMapRef.current.get(tappedFurnitureId);
  
          // Show tooltip on long press
          longPressTimerRef.current = setTimeout(() => {
            if (entry) {
              showTooltip(tappedFurnitureId, entry.mesh.position);
            }
          }, 500); // 500ms long press
          if (multiSelectMode) {
            // Multi-select mode: toggle selection
            toggleFurnitureSelection(tappedFurnitureId);
          } else {
            // CRITICAL: Individual furniture selection only - NO GROUP SELECTION
            // Every furniture item is treated as an independent, individually selectable object
            setDraggedFurnitureId(tappedFurnitureId);
            setIsDraggingFurniture(true);
            // Clear previous drag position refs when starting new drag
            latestDragPositionRef.current = null;
            pendingDragPositionRef.current = null;
            setSelectedPlacedId(tappedFurnitureId); // Select ONLY this individual object
            setSelectedLibraryItem(null); // Deselect library item
  
            // Store initial position and rotation for THIS individual object
            const entry = furnitureMapRef.current.get(tappedFurnitureId);
            if (entry && rootGroupRef.current && entry.mesh && entry.mesh.position) {
              setDragStartPosition(entry.mesh.position.clone());
              setDragStartRotation(entry.mesh.rotation.y);
              setDragRotation(0);
  
              // Lock scale when starting drag - store current scale
              const currentScale = entry.mesh.scale.x;
              lockedScaleRef.current.set(tappedFurnitureId, currentScale);
              if (!furnitureScale[tappedFurnitureId]) {
                setFurnitureScale(prev => ({ ...prev, [tappedFurnitureId]: currentScale }));
              }
  
              // Initialize gesture state to IDLE (will transition to MOVE_SINGLE_FINGER on first pan)
              setGestureState('IDLE');
  
              // Create ghost preview
              if (showDragGuides) {
                let ghostGeometry: THREE.BufferGeometry | null = null;
                if (entry.mesh instanceof THREE.Mesh && entry.mesh.geometry) {
                  ghostGeometry = entry.mesh.geometry.clone();
                } else if (entry.mesh instanceof THREE.Group) {
                  // Create bounding box geometry for groups
                  const box = new THREE.Box3().setFromObject(entry.mesh);
                  const size = box.getSize(new THREE.Vector3());
                  ghostGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
                }
  
                if (ghostGeometry && rootGroupRef.current) {
                  const ghostMaterial = new THREE.MeshStandardMaterial({
                    color: entry.item.color,
                    transparent: true,
                    opacity: 0.3,
                    wireframe: true,
                    side: THREE.DoubleSide,
                  });
                  const ghost = new THREE.Mesh(ghostGeometry, ghostMaterial);
                  ghost.position.copy(entry.mesh.position);
                  ghost.rotation.copy(entry.mesh.rotation);
                  ghost.scale.copy(entry.mesh.scale);
                  rootGroupRef.current.add(ghost);
                  dragGhostRef.current = ghost;
                }
              }
            }
  
            // Haptic feedback
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
          }
          return;
        }
  
        // If dragging, end drag
        if (isDraggingFurniture && draggedFurnitureId) {
          const draggedId = draggedFurnitureId; // Store before clearing
  
          // CRITICAL: Set flags BEFORE any async operations to prevent race conditions
          setIsDraggingFurniture(false);
          setDraggedFurnitureId(null);
  
          // Reset gesture state to IDLE
          setGestureState('IDLE');
  
          // Apply final drag position update using ref to prevent race conditions
          // Use the latest aligned position from ref instead of recalculating from potentially stale screen coordinates
          if (latestDragPositionRef.current) {
            const entry = furnitureMapRef.current.get(draggedId);
            if (entry) {
              const alignedPosition = latestDragPositionRef.current;
              // Apply final position update using the ref value, not stale state
              entry.mesh.position.set(
                alignedPosition.x,
                alignedPosition.y + entry.item.dimensions.height / 2,
                alignedPosition.z
              );
            }
            latestDragPositionRef.current = null;
          } else if (pendingDragPositionRef.current && rootGroupRef.current && raycasterRef.current && floorPlaneRef.current && cameraRef.current) {
            // Fallback: If ref is not available, recalculate from screen coordinates
            const finalPos = pendingDragPositionRef.current;
            const entry = furnitureMapRef.current.get(draggedId);
            if (entry) {
              const { width, height } = glLayoutRef.current;
              if (width > 0 && height > 0) {
                const ndc = new THREE.Vector2(
                  (finalPos.locationX / width) * 2 - 1,
                  -(finalPos.locationY / height) * 2 + 1,
                );
  
                raycasterRef.current.setFromCamera(ndc, cameraRef.current);
                const intersectionPoint = new THREE.Vector3();
                if (raycasterRef.current.ray.intersectPlane(floorPlaneRef.current, intersectionPoint)) {
                  const projected = arAnchorManager.projectToWorld(vector3ToSpatial(intersectionPoint));
                  const worldVector = spatialToVector3(projected);
                  const alignedPosition = alignToFloor(worldVector);
  
                  // Apply final position update
                  entry.mesh.position.set(
                    alignedPosition.x,
                    alignedPosition.y + entry.item.dimensions.height / 2,
                    alignedPosition.z
                  );
                }
              }
            }
            pendingDragPositionRef.current = null;
            latestDragPositionRef.current = null;
          }
  
          // Use try-finally to ensure cleanup always happens, even if placement logic fails
          try {
            const entry = furnitureMapRef.current.get(draggedId);
            if (entry) {
              // Reset emissive color immediately
              if (entry.mesh instanceof THREE.Mesh && entry.mesh.material instanceof THREE.MeshStandardMaterial) {
                entry.mesh.material.emissive.setHex(0x000000);
                entry.mesh.material.emissiveIntensity = 0;
              } else if (entry.mesh instanceof THREE.Group) {
                entry.mesh.traverse((child) => {
                  if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
                    child.material.emissive.setHex(0x000000);
                    child.material.emissiveIntensity = 0;
                  }
                });
              }
  
              // Final safety check
              if (!entry.mesh.position) return;
              const currentPos = entry.mesh.position.clone();
              currentPos.y -= entry.item.dimensions.height / 2; // Get floor position
              const tempBox = createFurnitureBoundingBox(
                currentPos,
                entry.item.dimensions,
                { y: entry.mesh.rotation.y }
              );
              const safetyInfo = getPlacementSafety(
                tempBox,
                obstacleMapRef.current,
                furnitureMapRef.current,
                roomData,
                draggedId,
                CONFIG.COLLISION_MARGIN
              );
  
              // If unsafe, revert to start position and rotation
              if (safetyInfo.safetyLevel === 'danger' && dragStartPosition && dragStartRotation !== null) {
                entry.mesh.position.copy(dragStartPosition);
                entry.mesh.rotation.y = dragStartRotation;
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
                setComponentError('Cannot place here - collision detected. Reverted to previous position.');
              } else {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
                // Save to history if enabled (with validation to prevent corruption)
                if (CONFIG.DRAG_HISTORY_ENABLED) {
                  saveToHistoryWithSceneCheck([...placedFurniture]);
                }
              }
            }
          } finally {
            // Guaranteed cleanup - always executes, even if placement logic throws an error
            cleanupAlignmentLines();
            cleanupDimensionLabels();
            cleanupConstraintLines();
  
            // Clean up drag ghost
            if (dragGhostRef.current && rootGroupRef.current) {
              rootGroupRef.current.remove(dragGhostRef.current);
              if (dragGhostRef.current instanceof THREE.Group) {
                disposeObjectRecursive(dragGhostRef.current);
              } else {
                disposeMesh(dragGhostRef.current);
              }
              dragGhostRef.current = null;
            }
  
            // Reset all drag-related state
            setDragRotation(0);
            setMagneticSnapActive(false);
            setSnapType(null);
            setDragStartPosition(null);
            setDragStartRotation(null);
            setPlacementSafety({
              isSafe: true,
              safetyLevel: 'safe',
              safetyScore: 100,
              reason: null,
              hasObstacleCollision: false,
              hasFurnitureCollision: false,
              hasWallCollision: false,
              isOutOfBounds: false,
              nearestObstacleDistance: null,
              nearestWallDistance: null,
              nearestFurnitureDistance: null,
              recommendations: [],
            });
  
            // Hide reticle after placing furniture
            if (reticleRef.current) {
              reticleRef.current.visible = false;
            }
  
            // Clear drag position refs
            latestDragPositionRef.current = null;
            reticleWorldPositionRef.current = null;
            reticleSmoothedPositionRef.current = null;
  
            // Remove and dispose preview ghost completely after placing
            if (previewGhostRef.current && rootGroupRef.current) {
              rootGroupRef.current.remove(previewGhostRef.current);
              disposeObjectRecursive(previewGhostRef.current);
              previewGhostRef.current = null;
            }
  
            // Clear pending drag position to prevent stale data
            pendingDragPositionRef.current = null;
            latestDragPositionRef.current = null;
          }
  
          return;
        }
  
        // Normal placement flow
        if (!selectedLibraryItem) {
          return;
        }
  
        updateReticleFromScreen();
  
        const fallbackIntersection = new THREE.Vector3();
        let worldPoint: THREE.Vector3 | null = null;
  
        if (reticleWorldPositionRef.current) {
          // Reuse Vector3 object instead of cloning
          worldPoint = new THREE.Vector3();
          worldPoint.copy(reticleWorldPositionRef.current);
        } else {
          const { width, height } = glLayoutRef.current;
          if (height === 0 || width === 0) {
            return;
          }
  
          const ndc = new THREE.Vector2(
            (locationX / width) * 2 - 1,
            -(locationY / height) * 2 + 1,
          );
  
          if (!raycasterRef.current || !floorPlaneRef.current) return;
  
          raycasterRef.current.setFromCamera(ndc, cameraRef.current);
          if (raycasterRef.current.ray.intersectPlane(floorPlaneRef.current, fallbackIntersection)) {
            const projectedPoint = arAnchorManager.projectToWorld(vector3ToSpatial(fallbackIntersection));
            worldPoint = spatialToVector3(projectedPoint);
          }
        }
  
        if (worldPoint) {
          // Clean up any existing visual guides before placing
          cleanupAlignmentLines();
          cleanupDimensionLabels();
          cleanupConstraintLines();
  
          // Hide reticle before placing
          if (reticleRef.current) {
            reticleRef.current.visible = false;
          }
  
          addFurnitureToScene(worldPoint);
        }
      },
      [rendererReady, addFurnitureToScene, selectedLibraryItem, updateReticleFromScreen, isDraggingFurniture, draggedFurnitureId, dragStartPosition, detectFurnitureAtScreenPoint, roomData, measurementMode, measurementPoints, calculateDistance, calculateArea, calculateVolume, cleanupAlignmentLines, cleanupDimensionLabels, cleanupConstraintLines],
    );

  const handleScenePan = useCallback(
      (event: GestureResponderEvent) => {
        if (!rendererReady || !cameraRef.current) {
          return;
        }
  
        const { locationX, locationY, touches } = event.nativeEvent;
        const touchCount = touches?.length || 1;
  
        // Gesture State Machine: Handle state transitions
        if (touchCount === 2 && selectedPlacedId && isARActive) {
          // Transition to PINCH_OR_ROTATE_TWO_FINGERS state
          if (gestureState !== 'PINCH_OR_ROTATE_TWO_FINGERS') {
            setGestureState('PINCH_OR_ROTATE_TWO_FINGERS');
            // Reset single-finger drag state
            if (isDraggingFurniture) {
              setIsDraggingFurniture(false);
              setDraggedFurnitureId(null);
            }
          }
        } else if (touchCount === 1 && selectedPlacedId && isARActive) {
          // Start dragging if furniture is selected and user moves finger
          // Transition to MOVE_SINGLE_FINGER state
          if (gestureState !== 'MOVE_SINGLE_FINGER') {
            setGestureState('MOVE_SINGLE_FINGER');
  
            // Start dragging if not already dragging
            if (!isDraggingFurniture) {
              setIsDraggingFurniture(true);
              setDraggedFurnitureId(selectedPlacedId);
  
              // Store initial position
              const entry = furnitureMapRef.current.get(selectedPlacedId);
              if (entry && entry.mesh && entry.mesh.position) {
                setDragStartPosition(entry.mesh.position.clone());
                setDragStartRotation(entry.mesh.rotation.y);
                setDragRotation(0);
  
                // Lock scale when entering single-finger move mode
                const currentScale = entry.mesh.scale.x;
                lockedScaleRef.current.set(selectedPlacedId, currentScale);
                if (!furnitureScale[selectedPlacedId]) {
                  setFurnitureScale(prev => ({ ...prev, [selectedPlacedId]: currentScale }));
                }
              }
            } else if (draggedFurnitureId) {
              // Already dragging, just ensure scale is locked
              const entry = furnitureMapRef.current.get(draggedFurnitureId);
              if (entry) {
                const currentScale = entry.mesh.scale.x;
                lockedScaleRef.current.set(draggedFurnitureId, currentScale);
              }
            }
  
            // Reset two-finger rotation state
            if (isRotatingFurniture) {
              setIsRotatingFurniture(false);
              setRotationStartAngle(null);
              setRotationStartTouchAngle(null);
              twoFingerStartRef.current = null;
            }
          }
        }
  
        // Two finger gesture: Rotate furniture (PINCH_OR_ROTATE_TWO_FINGERS state)
        if (touchCount === 2 && selectedPlacedId && isARActive && gestureState === 'PINCH_OR_ROTATE_TWO_FINGERS') {
          const touch1 = touches[0];
          const touch2 = touches[1];
  
          // Calculate center point and angle between two touches
          const centerX = (touch1.pageX + touch2.pageX) / 2;
          const centerY = (touch1.pageY + touch2.pageY) / 2;
          const dx = touch2.pageX - touch1.pageX;
          const dy = touch2.pageY - touch1.pageY;
          const currentAngle = Math.atan2(dy, dx);
          const currentDistance = Math.sqrt(dx * dx + dy * dy);
  
          if (!isRotatingFurniture) {
            // Start rotation
            setIsRotatingFurniture(true);
            const entry = furnitureMapRef.current.get(selectedPlacedId);
            if (entry) {
              setRotationStartAngle(entry.mesh.rotation.y);
              setRotationStartTouchAngle(currentAngle);
              twoFingerStartRef.current = { angle: currentAngle, distance: currentDistance, centerX, centerY };
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
            }
          } else if (rotationStartAngle !== null && rotationStartTouchAngle !== null) {
            // Continue rotation
            const entry = furnitureMapRef.current.get(selectedPlacedId);
            if (entry) {
              const angleDelta = currentAngle - rotationStartTouchAngle;
              const newRotation = rotationStartAngle + angleDelta;
  
              // Apply rotation with snapping if enabled
              const finalRotation = snapToGrid ? snapRotation(newRotation) : newRotation;
              entry.mesh.rotation.y = finalRotation;
  
              // Provide haptic feedback during rotation
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
            }
          }
          return;
        }
  
        // Single finger gesture: Move furniture ONLY (MOVE_SINGLE_FINGER state)
        // Also allow dragging if furniture is selected, even if gesture state hasn't fully transitioned yet
        if (touchCount === 1 && (gestureState === 'MOVE_SINGLE_FINGER' || (selectedPlacedId && isARActive))) {
          // If dragging furniture, update its position with enhancements
          const furnitureId = draggedFurnitureId || selectedPlacedId || '';
          if (furnitureId && (isDraggingFurniture || selectedPlacedId)) {
            // Ensure dragging state is set
            if (!isDraggingFurniture) {
              setIsDraggingFurniture(true);
              setDraggedFurnitureId(furnitureId);
            }
            // Throttle drag updates for performance, but always store the latest position
            const now = Date.now();
            const shouldUpdate = now - lastDragUpdateRef.current >= CONFIG.DRAG_UPDATE_THROTTLE;
  
            // Always store the latest position to ensure final update is never missed
            pendingDragPositionRef.current = { locationX, locationY };
  
            // Skip update if throttled, but position is stored for final update
            if (!shouldUpdate) {
              return;
            }
  
            lastDragUpdateRef.current = now;
            const { width, height } = glLayoutRef.current;
            if (width === 0 || height === 0) return;
  
            const ndc = new THREE.Vector2(
              (locationX / width) * 2 - 1,
              -(locationY / height) * 2 + 1,
            );
  
            if (!raycasterRef.current || !floorPlaneRef.current) return;
  
            raycasterRef.current.setFromCamera(ndc, cameraRef.current);
            const intersectionPoint = new THREE.Vector3();
  
            if (raycasterRef.current.ray.intersectPlane(floorPlaneRef.current, intersectionPoint)) {
              const projected = arAnchorManager.projectToWorld(vector3ToSpatial(intersectionPoint));
              let worldVector = spatialToVector3(projected);
              let alignedPosition = alignToFloor(worldVector);
  
              // Apply grid snapping if enabled
              if (snapToGrid) {
                alignedPosition = snapToGridPosition(alignedPosition);
              }
  
              // Check for alignment with other furniture
              const entry = furnitureMapRef.current.get(furnitureId);
              if (entry) {
                const item = entry.item;
  
                // CRITICAL: Lock scale during single-finger drag - NEVER allow scale to change
                const lockedScale = lockedScaleRef.current.get(furnitureId) ?? (furnitureScale[furnitureId] || 1.0);
                // Force scale to locked value - this prevents ANY accidental scaling
                if (Math.abs(entry.mesh.scale.x - lockedScale) > 0.001 ||
                  Math.abs(entry.mesh.scale.y - lockedScale) > 0.001 ||
                  Math.abs(entry.mesh.scale.z - lockedScale) > 0.001) {
                  entry.mesh.scale.setScalar(lockedScale);
                }
  
                // Check for magnetic snapping (wall, corner, edge, furniture)
                let detectedSnapType: 'wall' | 'corner' | 'edge' | 'furniture' | null = null;
                let snapApplied = false;
  
                // Priority: Corner > Wall > Edge > Furniture
                const cornerSnap = findCornerSnapTargets(alignedPosition, roomData);
                if (cornerSnap) {
                  if (cornerSnap.x !== undefined) alignedPosition.x = cornerSnap.x;
                  if (cornerSnap.z !== undefined) alignedPosition.z = cornerSnap.z;
                  detectedSnapType = 'corner';
                  snapApplied = true;
                } else {
                  const wallSnaps = findWallSnapTargets(alignedPosition, roomData);
                  if (wallSnaps.x !== undefined || wallSnaps.z !== undefined) {
                    if (wallSnaps.x !== undefined) alignedPosition.x = wallSnaps.x;
                    if (wallSnaps.z !== undefined) alignedPosition.z = wallSnaps.z;
                    detectedSnapType = 'wall';
                    snapApplied = true;
                  } else {
                    const edgeSnaps = findEdgeAlignmentTargets(alignedPosition, item.dimensions, roomData);
                    if (edgeSnaps.x !== undefined || edgeSnaps.z !== undefined) {
                      if (edgeSnaps.x !== undefined) alignedPosition.x = edgeSnaps.x;
                      if (edgeSnaps.z !== undefined) alignedPosition.z = edgeSnaps.z;
                      detectedSnapType = 'edge';
                      snapApplied = true;
                    } else {
                      const alignments = findAlignmentTargets(
                        alignedPosition,
                        furnitureMapRef.current,
                        furnitureId || ''
                      );
                      if (alignments.x !== undefined || alignments.z !== undefined) {
                        if (alignments.x !== undefined) alignedPosition.x = alignments.x;
                        if (alignments.z !== undefined) alignedPosition.z = alignments.z;
                        detectedSnapType = 'furniture';
                        snapApplied = true;
                      }
                    }
                  }
                }
  
                // Update magnetic snap state and provide haptic feedback (batched)
                if (snapApplied && detectedSnapType) {
                  const wasSnapping = magneticSnapActive && snapType === detectedSnapType;
                  if (!wasSnapping) {
                    // New snap detected - provide haptic feedback
                    updateDragState({
                      magneticSnap: true,
                      snapType: detectedSnapType,
                    });
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
                  }
                } else {
                  // No snap detected - clear state (batched)
                  if (magneticSnapActive) {
                    updateDragState({
                      magneticSnap: false,
                      snapType: null,
                    });
                  }
                }
  
                // Apply alignments (for furniture alignment, already applied above)
                if (!snapApplied) {
                  const alignments = findAlignmentTargets(
                    alignedPosition,
                    furnitureMapRef.current,
                    furnitureId
                  );
                  if (alignments.x !== undefined) {
                    alignedPosition.x = alignments.x;
                  }
                  if (alignments.z !== undefined) {
                    alignedPosition.z = alignments.z;
                  }
                }
  
                // Apply rotation smoothly - always calculate from start rotation + current drag rotation
                const currentRotation = dragStartRotation !== null
                  ? dragStartRotation + dragRotation
                  : dragRotation;
  
                // Apply snapped rotation if needed
                const finalRotation = snapToGrid ? snapRotation(currentRotation) : currentRotation;
                entry.mesh.rotation.y = finalRotation;
  
                // Update furniture position
                entry.mesh.position.set(
                  alignedPosition.x,
                  alignedPosition.y + item.dimensions.height / 2,
                  alignedPosition.z
                );
  
                // Always store latest aligned position to prevent race conditions with rapid state updates
                latestDragPositionRef.current = alignedPosition.clone();
  
                // Update ghost preview with rotation (only if still dragging)
                if (dragGhostRef.current && showDragGuides && isDraggingFurniture && draggedFurnitureId) {
                  dragGhostRef.current.position.set(
                    alignedPosition.x,
                    alignedPosition.y + item.dimensions.height / 2,
                    alignedPosition.z
                  );
                  dragGhostRef.current.rotation.y = finalRotation;
                } else if (dragGhostRef.current && (!isDraggingFurniture || !draggedFurnitureId)) {
                  // Clean up drag ghost if drag ended
                  if (rootGroupRef.current && dragGhostRef.current instanceof THREE.Mesh) {
                    rootGroupRef.current.remove(dragGhostRef.current);
                    if (dragGhostRef.current.geometry) {
                      dragGhostRef.current.geometry.dispose();
                    }
                    if (dragGhostRef.current.material) {
                      if (Array.isArray(dragGhostRef.current.material)) {
                        dragGhostRef.current.material.forEach((mat: THREE.Material) => mat.dispose());
                      } else {
                        dragGhostRef.current.material.dispose();
                      }
                    }
                    dragGhostRef.current = null;
                  } else if (rootGroupRef.current && dragGhostRef.current instanceof THREE.Group) {
                    rootGroupRef.current.remove(dragGhostRef.current);
                    disposeObjectRecursive(dragGhostRef.current);
                    dragGhostRef.current = null;
                  }
                }
  
                // Check safety during drag with current rotation (throttled)
                if (now - lastCollisionCheckRef.current >= CONFIG.COLLISION_CHECK_THROTTLE) {
                  lastCollisionCheckRef.current = now;
  
                  const tempBox = createFurnitureBoundingBox(
                    alignedPosition,
                    item.dimensions,
                    { y: finalRotation }
                  );
                  const safetyInfo = getPlacementSafety(
                    tempBox,
                    obstacleMapRef.current,
                    furnitureMapRef.current,
                    roomData,
                    draggedFurnitureId || undefined,
                    CONFIG.COLLISION_MARGIN
                  );
  
                  // Update safety indicator (batched)
                  updateDragState({ safety: safetyInfo });
  
                  // Announce safety status changes for accessibility
                  if (safetyInfo.safetyLevel !== placementSafety.safetyLevel) {
                    const safetyAnnouncement = `Safety status: ${safetyInfo.safetyLevel}. Safety score: ${safetyInfo.safetyScore} percent. ${safetyInfo.reason || ''}`;
                    AccessibilityInfo.announceForAccessibility(safetyAnnouncement);
                  }
  
                  // Visual feedback: change color based on safety
                  const updateSafetyEmissive = (mesh: THREE.Mesh | THREE.Group, hex: number, intensity: number) => {
                    if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshStandardMaterial) {
                      mesh.material.emissive.setHex(hex);
                      mesh.material.emissiveIntensity = intensity;
                    } else if (mesh instanceof THREE.Group) {
                      mesh.traverse((child) => {
                        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
                          child.material.emissive.setHex(hex);
                          child.material.emissiveIntensity = intensity;
                        }
                      });
                    }
                  };
  
                  if (safetyInfo.safetyLevel === 'danger') {
                    updateSafetyEmissive(entry.mesh, 0xff0000, 0.4);
                  } else if (safetyInfo.safetyLevel === 'warning') {
                    updateSafetyEmissive(entry.mesh, 0xffaa00, 0.25);
                  } else {
                    updateSafetyEmissive(entry.mesh, 0x00ff00, 0.15);
                  }
                }
  
                // Update visual guides only if still actively dragging
                if (isDraggingFurniture && draggedFurnitureId) {
                  // Update alignment lines if enabled and alignments exist
                  // Check for furniture alignment separately (not part of magnetic snap)
                  const furnitureAlignments = findAlignmentTargets(
                    alignedPosition,
                    furnitureMapRef.current,
                    draggedFurnitureId
                  );
                  if (showDragGuides && (furnitureAlignments.x !== undefined || furnitureAlignments.z !== undefined)) {
                    updateAlignmentLines(entry.mesh, furnitureAlignments);
                  } else {
                    // Always clear lines when no alignments or guides are off
                    cleanupAlignmentLines();
                  }
  
                  // Update dimension labels during drag
                  if (showDragGuides) {
                    updateDimensionLabels(entry.mesh, item);
                  } else {
                    cleanupDimensionLabels();
                  }
  
                  // Show room boundary constraints
                  if (showDragGuides) {
                    showRoomConstraints(alignedPosition, item.dimensions);
                  } else {
                    cleanupConstraintLines();
                  }
                } else {
                  // Drag ended - clean up all visual guides
                  cleanupAlignmentLines();
                  cleanupDimensionLabels();
                  cleanupConstraintLines();
                }
  
                // Save to history (throttled to prevent flooding)
                if (CONFIG.DRAG_HISTORY_ENABLED) {
                  const now = Date.now();
                  if (now - lastHistorySaveRef.current >= CONFIG.DRAG_HISTORY_THROTTLE) {
                    lastHistorySaveRef.current = now;
                    // History will be saved on drag end
                  }
                }
              }
            }
          } else {
            // Normal reticle update when not dragging
            updateReticleFromScreen();
          }
        } else {
          // No valid touch count or invalid state - reset to IDLE
          if (gestureState !== 'IDLE') {
            setGestureState('IDLE');
          }
        }
      },
      [rendererReady, updateReticleFromScreen, isDraggingFurniture, draggedFurnitureId, roomData, snapToGrid, showDragGuides, dragRotation, dragStartRotation, updateAlignmentLines, magneticSnapActive, cleanupAlignmentLines, updateDimensionLabels, cleanupDimensionLabels, showRoomConstraints, cleanupConstraintLines, selectedPlacedId, isARActive, isRotatingFurniture, rotationStartAngle, rotationStartTouchAngle, gestureState, furnitureScale],
    );

  const updateDragState = useCallback((updates: {
      safety?: typeof placementSafety;
      magneticSnap?: boolean;
      snapType?: typeof snapType;
    }) => {
      // Use a queue to prevent lost updates
      const pendingUpdates = dragStateUpdateQueue.current;
      pendingUpdates.push(updates);
  
      if (dragStateUpdateTimeoutRef.current !== null) {
        return; // Already scheduled
      }
  
      dragStateUpdateTimeoutRef.current = requestAnimationFrame(() => {
        try {
          // Process all pending updates atomically
          const allUpdates = pendingUpdates.reduce((acc, update) => ({
            ...acc,
            ...update
          }), {});
  
          // Use startTransition to mark these as non-urgent updates, reducing re-renders
          startTransition(() => {
            if (allUpdates.safety) setPlacementSafety(allUpdates.safety);
            if (allUpdates.magneticSnap !== undefined) setMagneticSnapActive(allUpdates.magneticSnap);
            if (allUpdates.snapType !== undefined) setSnapType(allUpdates.snapType);
          });
        } catch (error) {
          console.error('[ARView] Error processing drag state updates:', error);
        } finally {
          // Always clear the queue, even if there was an error
          pendingUpdates.length = 0;
          dragStateUpdateTimeoutRef.current = null;
        }
      });
    }, []);

  return {
    handleSceneTap,
    handleScenePan,
    updateDragState,
  };
}
