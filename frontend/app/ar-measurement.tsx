/**
 * AR-Based Room Measurement Screen
 * Based on PDF: "AR-Based Room Measurement"
 * 
 * Simple tap-to-measure interface using ARCore/ARKit
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { arMeasurementService, type Measurement, type MeasurementPoint } from '@/services/ARMeasurementService';
import { arCoreManager } from '@/services/ARCoreManager';
import { isARSessionAvailable } from '@/native/ARSessionNative';
import { colors, spacing, radii, shadows } from '@/components/ui/theme';
import { BackIcon } from '@/components/ui/Icons';
import { useTheme } from '@/contexts/ThemeContext';

export default function ARMeasurementScreen() {
  const router = useRouter();
  const { colors: themeColors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [isARActive, setIsARActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<MeasurementPoint[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [unitSystem, setUnitSystem] = useState<'metric' | 'imperial'>('metric');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [measurementName, setMeasurementName] = useState('');

  // Initialize AR
  useEffect(() => {
    const initializeAR = async () => {
      if (isARActive) {
        setIsInitializing(true);
        try {
          await arCoreManager.initialize();
          await arCoreManager.startTracking();
          console.log('[ARMeasurement] AR initialized');
        } catch (error) {
          console.error('[ARMeasurement] AR initialization failed:', error);
          Alert.alert('Error', 'Failed to initialize AR. Please try again.');
        } finally {
          setIsInitializing(false);
        }
      }
    };

    initializeAR();

    return () => {
      if (isARActive) {
        arCoreManager.stopTracking();
      }
    };
  }, [isARActive]);

  // Handle screen tap for measurement
  const handleScreenTap = useCallback(async (event: any) => {
    if (!isARActive || isInitializing) return;

    const { locationX, locationY } = event.nativeEvent;
    console.log('[ARMeasurement] Screen tapped:', { locationX, locationY });

    // Perform hit test to get 3D point
    const point = await arMeasurementService.tapToMeasure(locationX, locationY);

    if (!point) {
      Alert.alert('Measurement Failed', 'Could not detect surface. Try tapping on a well-defined point with good lighting.');
      return;
    }

    // Add point and check if measurement is complete
    const measurement = arMeasurementService.addPoint(point);
    
    setCurrentPoints(arMeasurementService.getCurrentPoints());

    if (measurement) {
      // Two points collected, measurement complete
      setMeasurements(arMeasurementService.getMeasurements());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      
      const distanceText = unitSystem === 'metric'
        ? `${measurement.distanceMeters.toFixed(2)} m`
        : `${measurement.distanceFeet.toFixed(2)} ft`;
      
      Alert.alert('Measurement Complete', `Distance: ${distanceText}`, [
        { text: 'OK' },
      ]);
    } else {
      // First point placed, waiting for second
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, [isARActive, isInitializing, unitSystem]);

  // Toggle AR
  const handleToggleAR = useCallback(async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera permission is needed for AR measurement.');
        return;
      }
    }

    setIsARActive(prev => !prev);
  }, [permission, requestPermission]);

  // Clear current measurement
  const handleClear = useCallback(() => {
    arMeasurementService.clearCurrentPoints();
    setCurrentPoints([]);
  }, []);

  // Clear all measurements
  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Clear All Measurements',
      'Are you sure you want to clear all measurements?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            arMeasurementService.clearAllMeasurements();
            setMeasurements([]);
            setCurrentPoints([]);
          },
        },
      ]
    );
  }, []);

  // Save measurements
  const handleSave = useCallback(async () => {
    if (!measurementName.trim()) {
      Alert.alert('Error', 'Please enter a measurement name');
      return;
    }

    const saved = await arMeasurementService.saveMeasurement(measurementName.trim());
    
    if (saved) {
      Alert.alert('Success', 'Measurements saved successfully', [
        { text: 'OK', onPress: () => setShowSaveModal(false) },
      ]);
    } else {
      Alert.alert('Error', 'Failed to save measurements');
    }
  }, [measurementName]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {!permission?.granted ? (
        <View style={styles.permissionContainer}>
          <Feather name="camera" size={48} color={themeColors.accent} style={{ marginBottom: 16 }} />
          <Text style={styles.permissionTitle}>Camera Access Needed</Text>
          <Text style={styles.permissionText}>
            Allow camera access to measure distances with AR.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Camera View */}
          <View style={styles.cameraContainer}>
            {isARActive ? (
              <>
                {isARSessionAvailable() ? (
                  <View style={styles.nativeArViewport}>
                    <Text style={styles.nativeArHint}>
                      {Platform.OS === 'android' ? 'ARCore' : 'ARKit'} session active — move device to scan surfaces
                    </Text>
                  </View>
                ) : (
                  <CameraView style={StyleSheet.absoluteFill} facing="back" />
                )}
                <TouchableOpacity
                  style={StyleSheet.absoluteFill}
                  activeOpacity={1}
                  onPress={handleScreenTap}
                />
                
                {isInitializing && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                    <Text style={styles.loadingText}>Initializing AR...</Text>
                  </View>
                )}

                {/* Instructions */}
                <View style={styles.instructionOverlay}>
                  <Text style={styles.instructionText}>
                    {currentPoints.length === 0
                      ? 'Tap two points to measure distance'
                      : `Point 1 placed. Tap point 2...`
                    }
                  </Text>
                </View>

                {/* Current Points Indicator */}
                {currentPoints.length > 0 && (
                  <View style={styles.pointsIndicator}>
                    <Text style={styles.pointsText}>
                      Points: {currentPoints.length}/2
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.placeholderView}>
                <Feather name="maximize-2" size={48} color={themeColors.accent} style={{ marginBottom: 16 }} />
                <Text style={styles.placeholderTitle}>AR Measurement</Text>
                <Text style={styles.placeholderText}>
                  Activate AR to start measuring
                </Text>
              </View>
            )}

            {/* Top Controls */}
            <View style={styles.topControls}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <BackIcon size={20} color={colors.accent} />
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.arToggleButton, isARActive && styles.arToggleButtonActive]}
                onPress={handleToggleAR}
              >
                <Text style={styles.arToggleText}>
                  {isARActive ? 'Exit AR' : 'Start AR'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom Panel */}
          <View style={styles.bottomPanel}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Unit Toggle */}
              <View style={styles.unitToggleContainer}>
                <Text style={styles.sectionTitle}>Units</Text>
                <View style={styles.unitToggle}>
                  <TouchableOpacity
                    style={[styles.unitButton, unitSystem === 'metric' && styles.unitButtonActive]}
                    onPress={() => setUnitSystem('metric')}
                  >
                    <Text style={[styles.unitButtonText, unitSystem === 'metric' && styles.unitButtonTextActive]}>
                      Meters
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.unitButton, unitSystem === 'imperial' && styles.unitButtonActive]}
                    onPress={() => setUnitSystem('imperial')}
                  >
                    <Text style={[styles.unitButtonText, unitSystem === 'imperial' && styles.unitButtonTextActive]}>
                      Feet
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Current Points */}
              {currentPoints.length > 0 && (
                <View style={styles.currentPointsCard}>
                  <Text style={styles.sectionTitle}>Current Measurement</Text>
                  <Text style={styles.currentPointsText}>
                    {currentPoints.length === 1
                      ? 'Waiting for second point...'
                      : 'Measurement complete!'}
                  </Text>
                  <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Measurements List */}
              {measurements.length > 0 && (
                <View style={styles.measurementsList}>
                  <View style={styles.measurementsHeader}>
                    <Text style={styles.sectionTitle}>Measurements ({measurements.length})</Text>
                    <TouchableOpacity onPress={handleClearAll}>
                      <Text style={styles.clearAllText}>Clear All</Text>
                    </TouchableOpacity>
                  </View>
                  {measurements.map((measurement, index) => (
                    <View key={measurement.id} style={styles.measurementItem}>
                      <Text style={styles.measurementLabel}>Measurement {index + 1}</Text>
                      <Text style={styles.measurementValue}>
                        {unitSystem === 'metric'
                          ? `${measurement.distanceMeters.toFixed(2)} m`
                          : `${measurement.distanceFeet.toFixed(2)} ft`
                        }
                      </Text>
                      <Text style={styles.measurementSubtext}>
                        {unitSystem === 'metric'
                          ? `(${measurement.distanceFeet.toFixed(2)} ft)`
                          : `(${measurement.distanceMeters.toFixed(2)} m)`
                        }
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Action Buttons */}
              {measurements.length > 0 && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={() => setShowSaveModal(true)}
                  >
                    <Text style={styles.saveButtonText}>Save Measurements</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Instructions Card */}
              <View style={styles.instructionsCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Feather name="clipboard" size={16} color="#1E293B" />
                  <Text style={styles.instructionsTitle}>Instructions</Text>
                </View>
                <Text style={styles.instructionsText}>
                  • Ensure good lighting and texture on surfaces{'\n'}
                  • Keep the phone steady when tapping points{'\n'}
                  • Tap on well-defined points (corners, edges){'\n'}
                  • Tap two points to measure the distance between them
                </Text>
              </View>
            </ScrollView>
          </View>

          {/* Save Modal */}
          <Modal
            visible={showSaveModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowSaveModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Save Measurements</Text>
                <TextInput
                  style={styles.nameInput}
                  placeholder="Measurement name"
                  value={measurementName}
                  onChangeText={setMeasurementName}
                  autoFocus
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={() => setShowSaveModal(false)}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonConfirm]}
                    onPress={handleSave}
                  >
                    <Text style={[styles.modalButtonText, styles.modalButtonTextConfirm]}>
                      Save
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surfacePrimary,
  },
  permissionEmoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  permissionText: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  permissionButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  nativeArViewport: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  nativeArHint: {
    color: '#e2e8f0',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  placeholderView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
  },
  placeholderEmoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  placeholderText: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
  },
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: 50,
    zIndex: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    gap: spacing.xs,
  },
  backButtonText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  arToggleButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  arToggleButtonActive: {
    backgroundColor: colors.accent,
  },
  arToggleText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  instructionOverlay: {
    position: 'absolute',
    top: 120,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: spacing.lg,
    borderRadius: radii.lg,
    zIndex: 10,
    ...shadows.md,
  },
  instructionText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  pointsIndicator: {
    position: 'absolute',
    top: 200,
    left: spacing.md,
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    zIndex: 10,
  },
  pointsText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomPanel: {
    backgroundColor: colors.surfacePrimary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: 40,
    maxHeight: Dimensions.get('window').height * 0.5,
    ...shadows.lg,
  },
  unitToggleContainer: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  unitToggle: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  unitButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
  },
  unitButtonActive: {
    backgroundColor: colors.accent,
  },
  unitButtonText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  unitButtonTextActive: {
    color: '#FFFFFF',
  },
  currentPointsCard: {
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.lg,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
  },
  currentPointsText: {
    color: colors.textPrimary,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  clearButton: {
    backgroundColor: colors.danger || '#ff3b30',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  measurementsList: {
    marginBottom: spacing.lg,
  },
  measurementsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  clearAllText: {
    color: colors.danger || '#ff3b30',
    fontSize: 14,
    fontWeight: '600',
  },
  measurementItem: {
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
  },
  measurementLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  measurementValue: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  measurementSubtext: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  actionButtons: {
    marginBottom: spacing.lg,
  },
  saveButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionsCard: {
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.lg,
    borderRadius: radii.md,
    marginTop: spacing.md,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  instructionsText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surfacePrimary,
    borderRadius: radii.lg,
    padding: spacing.xl,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  nameInput: {
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    borderRadius: radii.md,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: colors.surfaceSecondary,
  },
  modalButtonConfirm: {
    backgroundColor: colors.accent,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalButtonTextConfirm: {
    color: '#FFFFFF',
  },
});
