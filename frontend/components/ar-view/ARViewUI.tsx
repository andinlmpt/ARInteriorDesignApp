import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import { GLView } from 'expo-gl';
import { StatusBar } from 'expo-status-bar';
import { AnimatedButton, AnimatedCard } from '@/components/interactive';
import { ARViewSkeleton } from '@/components/ui/SkeletonLoader';
import { colors } from '@/components/ui/theme';
import { styles } from '@/styles/arView.styles';

export function ARViewUI(props: any) {
  const {
    permission, requestPermission, isARActive, handleMarkerScanned, markerTrackingEnabled, handleCanvasLayout,
    handleScenePan, setGestureState, isRotatingFurniture, setIsRotatingFurniture, setRotationStartAngle,
    setRotationStartTouchAngle, twoFingerStartRef, handleSceneTap, onContextCreate, cameraMode, rendererReady,
    setCameraMode, setCameraZoom, setCameraRotation, router, rendererError, componentError, setComponentError,
    setRetryCount, isPlacingFurniture, selectedLibraryItem, reticleWorldPositionRef, addFurnitureToScene,
    handleToggleAR, arUnavailable, setArLimitedDismissed, setIsARActive, arLimitedDismissed, isInitializing,
    anchorStatus, statusMessageDismissed, placedFurniture, showPlacementHint, placementSafety, isDraggingFurniture,
    draggedFurnitureId, selectedPlacedId, libraryPanelVisible, bottomSheetOpacity, setLibraryPanelVisible,
    bottomSheetHeight, maxPanelHeight, bottomSheetPanResponder, measuredContentHeight, setMeasuredContentHeight,
    setMarkerTrackingEnabled, setLastMarkerPayload, setMarkerLastSeenAt, markerAnchorOffsetRef, selectedCategory,
    setSelectedCategory, furnitureCategories, lastMarkerPayload, markerLastSeenAt, filteredFurnitureLibrary,
    setSelectedLibraryItem, setShowFloor, getFurnitureIcon
  } = props;
  return (
      <View
        style={styles.container}
        accessibilityLabel={isARActive ? "AR view with furniture placement" : "AR view inactive"}
      >
        <StatusBar style="light" />
        {permission && !permission.granted ? (
          <View style={styles.permissionContainer}>
            <View style={styles.permissionIconContainer}>
              <Ionicons name="camera" size={64} color={colors.accent} />
            </View>
            <Text style={styles.permissionTitle}>Camera Access Needed</Text>
            <Text style={styles.permissionText}>
              Allow camera access to enter the augmented reality workspace.
            </Text>
            <AnimatedButton
              style={styles.permissionButton}
              onPress={requestPermission}
              accessibilityRole="button"
              accessibilityLabel="Grant camera permission"
              hapticType="success"
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </AnimatedButton>
          </View>
        ) : (
          <>
            <View style={styles.cameraWrapper}>
              {isARActive ? (
                <>
                  <CameraView
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    onBarcodeScanned={markerTrackingEnabled ? handleMarkerScanned : undefined}
                    barcodeScannerSettings={markerTrackingEnabled ? { barcodeTypes: ['qr'] } : undefined}
                  />
                  <View
                    style={styles.glContainer}
                    onLayout={handleCanvasLayout}
                    onStartShouldSetResponder={() => true}
                    onMoveShouldSetResponder={() => true}
                    onResponderGrant={handleScenePan}
                    onResponderMove={handleScenePan}
                    onResponderRelease={(event) => {
                      // Reset gesture state on release
                      setGestureState('IDLE');
                      // Reset rotation state on release
                      if (isRotatingFurniture) {
                        setIsRotatingFurniture(false);
                        setRotationStartAngle(null);
                        setRotationStartTouchAngle(null);
                        twoFingerStartRef.current = null;
                      }
                      handleSceneTap(event);
                    }}
                  >
                    <GLView
                      style={StyleSheet.absoluteFill}
                      onContextCreate={onContextCreate}
                    />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.placeholderView}>
                    <View style={styles.placeholderIconContainer}>
                      <Ionicons name="cube" size={80} color={colors.accent} />
                    </View>
                    <Text style={styles.placeholderTitle}>AR Studio</Text>
                    <Text style={styles.placeholderText}>
                      {cameraMode === 'preview'
                        ? 'Preview Mode: Use gestures to orbit, pan, and zoom'
                        : 'Activate AR to project your generated layouts into real space.'}
                    </Text>
                  </View>
                  {rendererReady && (
                    <View style={styles.previewModeControls}>
                      <TouchableOpacity
                        style={[styles.previewModeButton, cameraMode === 'preview' && styles.previewModeButtonActive]}
                        onPress={() => {
                          const newMode = cameraMode === 'preview' ? 'ar' : 'preview';
                          setCameraMode(newMode);
                          if (cameraMode === 'ar') {
                            // Reset camera for preview mode
                            setCameraZoom(1.0);
                            setCameraRotation({ x: 0.5, y: 0 });
                          }
                          AccessibilityInfo.announceForAccessibility(
                            `Switched to ${newMode === 'preview' ? 'preview' : 'AR'} mode`
                          );
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={cameraMode === 'preview' ? 'Switch to AR mode' : 'Switch to preview mode'}
                        accessibilityState={{ selected: cameraMode === 'preview' }}
                      >
                        <Ionicons
                          name={cameraMode === 'preview' ? 'phone-portrait' : 'cube'}
                          size={18}
                          color="#FFFFFF"
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.previewModeButtonText}>
                          {cameraMode === 'preview' ? 'Preview Mode' : 'AR Mode'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
  
              <View style={styles.topControls}>
                <AnimatedButton
                  style={styles.backButton}
                  onPress={() => {
                    if (router.canGoBack()) {
                      router.back();
                    } else {
                      // Fallback to home/index if no previous screen
                      router.replace('/(tabs)');
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                  hapticType="light"
                >
                  <Ionicons name="arrow-back" size={20} color={colors.accent} />
                  <Text style={styles.backButtonText}>Back</Text>
                </AnimatedButton>
  
                {/* Error Banner */}
                {(rendererError || componentError) && (
                  <View style={styles.errorBanner}>
                    <View style={styles.errorBannerContent}>
                      <Ionicons name="warning" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.errorText}>{rendererError || componentError}</Text>
                    </View>
                    <View style={styles.errorActions}>
                      <TouchableOpacity
                        style={styles.retryButton}
                        onPress={() => {
                          setComponentError(null);
                          setRetryCount(prev => prev + 1);
                          // Retry last operation based on context
                          if (isPlacingFurniture && selectedLibraryItem) {
                            // Retry furniture placement
                            const retryPosition = reticleWorldPositionRef.current || new THREE.Vector3(0, 0, 0);
                            addFurnitureToScene(retryPosition);
                          } else if (isARActive) {
                            // Retry AR initialization
                            handleToggleAR();
                            setTimeout(() => handleToggleAR(), 500);
                          }
                          AccessibilityInfo.announceForAccessibility('Retrying operation');
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Retry operation"
                      >
                        <Ionicons name="refresh" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.retryButtonText}>Retry</Text>
                      </TouchableOpacity>
                      {arUnavailable && (
                        <TouchableOpacity
                          style={styles.fallbackButton}
                          onPress={() => {
                            setCameraMode('preview');
                            setIsARActive(false);
                            setComponentError(null);
                            AccessibilityInfo.announceForAccessibility('Switched to preview mode as fallback');
                          }}
                          accessibilityRole="button"
                          accessibilityLabel="Use preview mode"
                        >
                          <Ionicons name="phone-portrait" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={styles.fallbackButtonText}>Preview Mode</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
  
                {/* AR Unavailable Fallback - Only show if not dismissed */}
                {arUnavailable && !componentError && !arLimitedDismissed && (
                  <View style={styles.fallbackBanner}>
                    <TouchableOpacity
                      style={styles.fallbackDismissButton}
                      onPress={() => {
                        setArLimitedDismissed(true);
                        setArUnavailable(false);
                      }}
                      accessibilityLabel="Dismiss warning"
                    >
                      <Ionicons name="close" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                    <View style={styles.fallbackContent}>
                      <Ionicons name="information-circle" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.fallbackText}>
                        AR features limited. Preview mode available.
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.fallbackButton}
                      onPress={() => {
                        setCameraMode('preview');
                        setArUnavailable(false);
                        setArLimitedDismissed(true);
                        AccessibilityInfo.announceForAccessibility('Preview mode activated');
                      }}
                    >
                      <Ionicons name="phone-portrait" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.fallbackButtonText}>Switch to Preview</Text>
                    </TouchableOpacity>
                  </View>
                )}
  
                {/* Loading Indicator with Skeleton */}
                {isInitializing && !rendererReady ? (
                  <ARViewSkeleton />
                ) : isInitializing ? (
                  <View style={styles.loadingIndicator} accessibilityLabel="Initializing AR view">
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.loadingTextPrimary} accessibilityLiveRegion="polite">
                      Initializing...
                    </Text>
                  </View>
                ) : null}
  
  
  
              </View>
  
              {/* Anchor Status Badge - Auto-hides after surface detection, subtle when furniture is placed */}
              {isARActive && (!anchorStatus.hasLock || !statusMessageDismissed) && (
                <View
                  style={[
                    styles.anchorStatusBadge,
                    anchorStatus.quality === 'good'
                      ? styles.anchorStatusGood
                      : anchorStatus.quality === 'medium'
                        ? styles.anchorStatusMedium
                        : styles.anchorStatusPoor,
                    // Reduce opacity and size when furniture is placed
                    placedFurniture.length > 0 && styles.anchorStatusSubtle,
                    // Move to corner when furniture is placed
                    placedFurniture.length > 0 && styles.anchorStatusCorner,
                  ]}
                >
                  <Text style={[
                    styles.anchorStatusTitle,
                    placedFurniture.length > 0 && styles.anchorStatusTitleSmall
                  ]}>
                    {anchorStatus.hasLock
                      ? anchorStatus.quality === 'good'
                        ? 'Anchor locked'
                        : 'Anchor stabilizing'
                      : 'Searching for surface'}
                  </Text>
                  {(!placedFurniture.length || !statusMessageDismissed) && (
                    <Text style={[
                      styles.anchorStatusSubtitle,
                      placedFurniture.length > 0 && styles.anchorStatusSubtitleSmall
                    ]}>
                      {anchorStatus.anchor
                        ? `confidence ${(Math.min(1, anchorStatus.anchor.confidence) * 100).toFixed(0)}%`
                        : anchorStatus.hints[0] ?? 'Move device slowly'}
                    </Text>
                  )}
                </View>
              )}
  
              {/* Subtle corner indicator when status is dismissed but surface is detected */}
              {isARActive && anchorStatus.hasLock && statusMessageDismissed && (
                <View style={styles.cornerStatusIndicator}>
                  <View style={[
                    styles.cornerStatusDot,
                    anchorStatus.quality === 'good' && styles.cornerStatusDotGood,
                    anchorStatus.quality === 'medium' && styles.cornerStatusDotMedium,
                    anchorStatus.quality === 'poor' && styles.cornerStatusDotPoor,
                  ]} />
                </View>
              )}
  
              {/* Simple Placement Safety Indicator */}
              {showPlacementHint && isARActive && selectedLibraryItem && !isPlacingFurniture && placementSafety.safetyLevel === 'danger' && (
                <View
                  style={styles.safetyIndicatorUnsafe}
                  accessibilityRole="alert"
                >
                  <Ionicons name="close-circle" size={24} color="#EF4444" style={{ marginRight: 8 }} />
                  <Text style={styles.safetyIndicatorTitle}>Cannot place here</Text>
                </View>
              )}
  
              {/* Gesture Instructions */}
              {isDraggingFurniture && draggedFurnitureId && (
                <View style={[styles.dragIndicator, styles.dragIndicatorSubtle]}>
                  <Ionicons name="move" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.dragIndicatorText}>Move to reposition</Text>
                </View>
              )}
              {isRotatingFurniture && selectedPlacedId && (
                <View style={[styles.dragIndicator, styles.dragIndicatorSubtle]}>
                  <Ionicons name="sync" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.dragIndicatorText}>Rotating object</Text>
                </View>
              )}
              {!isDraggingFurniture && !isRotatingFurniture && selectedPlacedId && isARActive && (
                <View style={[styles.dragIndicator, styles.dragIndicatorSubtle]}>
                  <Ionicons name="hand-left" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.dragIndicatorText}>One finger to move, two fingers to rotate</Text>
                </View>
              )}
  
  
  
  
              {/* Simple Placement Hint */}
              {showPlacementHint && isARActive && selectedLibraryItem && (
                <View style={styles.placementHint}>
                  {isPlacingFurniture ? (
                    <View style={styles.placingIndicator}>
                      <ActivityIndicator size="small" color="#6B4CE6" />
                      <Text style={styles.placingText}>Placing...</Text>
                    </View>
                  ) : (
                    <View style={styles.hintContent}>
                      <Ionicons name="hand-left-outline" size={20} color="#4C1D95" style={{ marginRight: 8 }} />
                      <Text style={styles.hintTitle}>Tap to place furniture</Text>
                    </View>
                  )}
                </View>
              )}
  
  
            </View>
  
            {/* Bottom Sheet Modal - Always visible with peek area */}
            <View
              style={styles.bottomSheetOverlay}
              pointerEvents="box-none"
            >
              {/* Backdrop - Only visible when expanded */}
              {libraryPanelVisible && (
                <Animated.View
                  style={[
                    styles.bottomSheetBackdrop,
                    {
                      opacity: bottomSheetOpacity,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={() => setLibraryPanelVisible(false)}
                  />
                </Animated.View>
              )}
  
              {/* Bottom Sheet Content */}
              <Animated.View
                style={[
                  styles.bottomSheetContainer,
                  {
                    height: bottomSheetHeight,
                    maxHeight: maxPanelHeight,
                    paddingTop: libraryPanelVisible ? 12 : 16,
                    paddingBottom: libraryPanelVisible ? 20 : 0,
                  },
                ]}
                {...bottomSheetPanResponder.panHandlers}
              >
                {/* Draggable Handle - Only show when expanded */}
                {libraryPanelVisible && (
                  <View style={styles.panelDragHandle}>
                    <View style={styles.dragHandleBar} />
                  </View>
                )}
  
                {/* Title - Always visible, this is what peeks when collapsed */}
                <TouchableOpacity
                  style={styles.panelTitleContainer}
                  onPress={() => {
                    if (!libraryPanelVisible) {
                      setLibraryPanelVisible(true);
                    }
                  }}
                  activeOpacity={0.7}
                  delayPressIn={100}
                >
                  <Text style={styles.panelTitle}>AR Furniture Library</Text>
                </TouchableOpacity>
  
                {libraryPanelVisible && (
                  <View
                    style={styles.panelScrollContent}
                    onLayout={(event) => {
                      const { height } = event.nativeEvent.layout;
                      if (height > 0 && Math.abs(height - measuredContentHeight) > 1) {
                        setMeasuredContentHeight(height);
                      }
                    }}
                  >
                    <View style={styles.panelHeader}>
                      <View style={styles.panelHeaderButtons}>
                        <TouchableOpacity
                          style={[
                            styles.toggleButton,
                            isARActive ? styles.toggleActive : styles.toggleInactive,
                          ]}
                          onPress={handleToggleAR}
                          accessibilityRole="button"
                          accessibilityLabel={isARActive ? 'Exit AR mode' : 'Enter AR mode'}
                          accessibilityState={{ selected: isARActive }}
                        >
                          <Text
                            style={[
                              styles.toggleButtonText,
                              !isARActive && styles.toggleButtonTextInactive,
                            ]}
                          >
                            {isARActive ? 'Exit AR' : 'Enter AR'}
                          </Text>
                        </TouchableOpacity>
  
                        <TouchableOpacity
                          style={[
                            styles.markerButton,
                            markerTrackingEnabled && styles.markerButtonActive,
                            !isARActive && styles.markerButtonDisabled,
                          ]}
                          onPress={() => {
                            if (!isARActive) return;
                            setMarkerTrackingEnabled((prev) => !prev);
                            setLastMarkerPayload(null);
                            setMarkerLastSeenAt(null);
                            markerAnchorOffsetRef.current = null;
                          }}
                          disabled={!isARActive}
                          accessibilityRole="button"
                          accessibilityLabel={markerTrackingEnabled ? 'Disable marker lock' : 'Enable marker lock'}
                          accessibilityState={{ selected: markerTrackingEnabled, disabled: !isARActive }}
                        >
                          <Text style={styles.markerButtonText}>
                            {markerTrackingEnabled ? 'Marker ON' : 'Marker OFF'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
  
                    {/* Category Filter */}
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.categoryFilter}
                      contentContainerStyle={styles.categoryFilterContent}
                    >
                      <TouchableOpacity
                        style={[
                          styles.categoryButton,
                          selectedCategory === 'all' && styles.categoryButtonActive
                        ]}
                        onPress={() => setSelectedCategory('all')}
                      >
                        <Text style={[
                          styles.categoryButtonText,
                          selectedCategory === 'all' && styles.categoryButtonTextActive
                        ]}>All</Text>
                      </TouchableOpacity>
                      {furnitureCategories.map(category => (
                        <TouchableOpacity
                          key={category}
                          style={[
                            styles.categoryButton,
                            selectedCategory === category && styles.categoryButtonActive
                          ]}
                          onPress={() => setSelectedCategory(category)}
                        >
                          <Text style={[
                            styles.categoryButtonText,
                            selectedCategory === category && styles.categoryButtonTextActive
                          ]}>
                            {category.charAt(0).toUpperCase() + category.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
  
                    {isARActive && anchorStatus.hints.length > 0 && !anchorStatus.hasLock && (
                      <View style={styles.anchorHintCard}>
                        <Text style={styles.anchorHintText}>
                          {anchorStatus.hints[0]}
                        </Text>
                      </View>
                    )}
  
                    {isARActive && markerTrackingEnabled && (
                      <View style={styles.anchorHintCard}>
                        <Text style={styles.anchorHintText}>
                          {lastMarkerPayload
                            ? `Marker detected: ${lastMarkerPayload}${markerLastSeenAt ? ` • ${Math.round((Date.now() - markerLastSeenAt) / 1000)}s ago` : ''
                            }`
                            : 'Marker lock enabled. Point camera at a QR marker to lock the anchor.'}
                        </Text>
                      </View>
                    )}
  
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.libraryScroll}
                      snapToInterval={162}
                      snapToAlignment="start"
                      decelerationRate="fast"
                      pagingEnabled={false}
                      scrollEventThrottle={16}
                      bounces={true}
                      alwaysBounceHorizontal={true}
                      directionalLockEnabled={true}
                      scrollEnabled={true}
                      nestedScrollEnabled={true}
                      removeClippedSubviews={true}
                      keyboardShouldPersistTaps="handled"
                    >
                      {filteredFurnitureLibrary.length === 0 ? (
                        <View key="empty" style={styles.emptyContainer}>
                          <Text style={styles.emptyText}>No furniture found</Text>
                          <Text style={styles.emptySubtext}>Try selecting a different category</Text>
                        </View>
                      ) : (
                        filteredFurnitureLibrary.map((item, index) => {
                          const isSelected = selectedLibraryItem === item.id;
                          // Ensure unique key - use id if available and valid, otherwise use index
                          const uniqueKey = item?.id && item.id !== '' ? item.id : `furniture-item-${index}`;
                          return (
                            <AnimatedCard
                              key={uniqueKey}
                              style={[
                                styles.furnitureCard,
                                isSelected && styles.furnitureCardSelected,
                              ]}
                              onPress={() => {
                                if (!isARActive) {
                                  handleToggleAR();
                                  setSelectedLibraryItem(item.id);
                                  setShowFloor(false); // Hide floor when selecting furniture
                                  return;
                                }
                                setSelectedLibraryItem((prev) => {
                                  const newSelection = prev === item.id ? null : item.id;
                                  setShowFloor(newSelection === null); // Show floor when deselecting
                                  return newSelection;
                                });
                              }}
                              hapticFeedback={true}
                            >
                              <View style={styles.furnitureThumbnail}>
                                <Ionicons
                                  name={getFurnitureIcon(item.category)}
                                  size={32}
                                  color={isSelected ? '#6B4CE6' : '#7C3AED'}
                                />
                                {item.thumbnail && (
                                  <View style={styles.thumbnailOverlay}>
                                    {/* Thumbnail image would go here if available */}
                                  </View>
                                )}
                              </View>
                              <Text style={styles.furnitureName}>{item.name}</Text>
                              <Text style={styles.furniturePrice}>{item.price}</Text>
                              <Text style={styles.furnitureSizeLabel}>
                                {item.dimensions.width.toFixed(1)}m × {item.dimensions.length.toFixed(1)}m
                              </Text>
                              <Text style={styles.furnitureCategoryLabel}>
                                {item.category}
                              </Text>
                            </AnimatedCard>
                          );
                        }))}
                    </ScrollView>
                  </View>
                )}
              </Animated.View>
            </View>
          </>
        )}
      </View>
    );
  }
  
  // Export wrapped with error boundary
  export default function ARViewScreenWithErrorBoundary() {
    return (
      <ARViewErrorBoundary>
        <ARViewScreen />
      </ARViewErrorBoundary>
    );
  }
