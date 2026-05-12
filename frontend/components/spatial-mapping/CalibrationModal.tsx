/**
 * Calibration Modal Component
 * Modal for calibrating depth measurements
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { CALIBRATION_REFERENCES, CalibrationReference } from '@/services/DepthEstimationService';
import type { CalibrationResult, CalibrationStep } from '@/types/spatial-mapping-ui';

interface CalibrationModalProps {
  visible: boolean;
  onClose: () => void;
  calibrationStep: CalibrationStep;
  selectedReference: CalibrationReference | null;
  detectedWidth: string;
  detectedHeight: string;
  calibrationResult: CalibrationResult | null;
  customReferenceWidth: string;
  customReferenceHeight: string;
  onSelectReference: (ref: CalibrationReference) => void;
  onDetectedWidthChange: (value: string) => void;
  onDetectedHeightChange: (value: string) => void;
  onCustomWidthChange: (value: string) => void;
  onCustomHeightChange: (value: string) => void;
  onPerformCalibration: () => void;
  onCreateCustomReference: () => CalibrationReference | null;
  onBack: () => void;
}

export function CalibrationModal({
  visible,
  onClose,
  calibrationStep,
  selectedReference,
  detectedWidth,
  detectedHeight,
  calibrationResult,
  customReferenceWidth,
  customReferenceHeight,
  onSelectReference,
  onDetectedWidthChange,
  onDetectedHeightChange,
  onCustomWidthChange,
  onCustomHeightChange,
  onPerformCalibration,
  onCreateCustomReference,
  onBack,
}: CalibrationModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>🎯 Calibration</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {calibrationStep === 'select' && (
            <ScrollView style={styles.content}>
              <Text style={styles.subtitle}>Select a reference object with known dimensions:</Text>
              
              {CALIBRATION_REFERENCES.map((ref) => (
                <TouchableOpacity
                  key={ref.id}
                  style={styles.referenceItem}
                  onPress={() => onSelectReference(ref)}
                >
                  <Text style={styles.referenceIcon}>{ref.icon}</Text>
                  <View style={styles.referenceInfo}>
                    <Text style={styles.referenceName}>{ref.name}</Text>
                    <Text style={styles.referenceSize}>
                      {(ref.realWidth * 100).toFixed(1)}cm × {(ref.realHeight * 100).toFixed(1)}cm
                    </Text>
                    <Text style={styles.referenceDesc}>{ref.description}</Text>
                  </View>
                  <Text style={styles.arrow}>→</Text>
                </TouchableOpacity>
              ))}

              {/* Custom Reference */}
              <View style={styles.customSection}>
                <Text style={styles.customTitle}>📐 Custom Object</Text>
                <Text style={styles.customHint}>Enter dimensions of any object you have:</Text>
                <View style={styles.inputRow}>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Width (cm)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., 30"
                      placeholderTextColor="#999"
                      keyboardType="decimal-pad"
                      value={customReferenceWidth}
                      onChangeText={onCustomWidthChange}
                    />
                  </View>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Height (cm)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., 20"
                      placeholderTextColor="#999"
                      keyboardType="decimal-pad"
                      value={customReferenceHeight}
                      onChangeText={onCustomHeightChange}
                    />
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.customButton}
                  onPress={() => {
                    const custom = onCreateCustomReference();
                    if (custom) onSelectReference(custom);
                  }}
                >
                  <Text style={styles.customButtonText}>Use Custom Object</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {calibrationStep === 'measure' && selectedReference && (
            <View style={styles.content}>
              <View style={styles.selectedCard}>
                <Text style={styles.selectedIcon}>{selectedReference.icon}</Text>
                <Text style={styles.selectedName}>{selectedReference.name}</Text>
                <Text style={styles.selectedSize}>
                  Real size: {(selectedReference.realWidth * 100).toFixed(1)}cm × {(selectedReference.realHeight * 100).toFixed(1)}cm
                </Text>
              </View>

              <Text style={styles.instructions}>
                Place the {selectedReference.name.toLowerCase()} in view and measure its apparent size:
              </Text>

              <View style={styles.inputRow}>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Detected Width (cm)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Width"
                    placeholderTextColor="#999"
                    keyboardType="decimal-pad"
                    value={detectedWidth}
                    onChangeText={onDetectedWidthChange}
                  />
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Detected Height (cm)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Height"
                    placeholderTextColor="#999"
                    keyboardType="decimal-pad"
                    value={detectedHeight}
                    onChangeText={onDetectedHeightChange}
                  />
                </View>
              </View>

              <Text style={styles.hint}>
                💡 Tip: Use a ruler or tape measure to measure the object as it appears on your screen.
              </Text>

              <View style={styles.buttons}>
                <TouchableOpacity style={styles.backButton} onPress={onBack}>
                  <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmButton} onPress={onPerformCalibration}>
                  <Text style={styles.confirmText}>Calibrate →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {calibrationStep === 'confirm' && calibrationResult && (
            <View style={styles.content}>
              <View style={[styles.resultCard, calibrationResult.success ? styles.success : styles.error]}>
                <Text style={styles.resultIcon}>{calibrationResult.success ? '✅' : '❌'}</Text>
                <Text style={styles.resultTitle}>
                  {calibrationResult.success ? 'Calibration Successful!' : 'Calibration Failed'}
                </Text>
                
                {calibrationResult.success && (
                  <>
                    <View style={styles.resultStats}>
                      <View style={styles.resultStat}>
                        <Text style={styles.statLabel}>Correction Factor</Text>
                        <Text style={styles.statValue}>{calibrationResult.factor.toFixed(3)}x</Text>
                      </View>
                      <View style={styles.resultStat}>
                        <Text style={styles.statLabel}>Estimated Accuracy</Text>
                        <Text style={styles.statValue}>{calibrationResult.accuracy.toFixed(1)}%</Text>
                      </View>
                    </View>
                    <Text style={styles.resultHint}>
                      All future measurements will be adjusted by this factor for better accuracy.
                    </Text>
                  </>
                )}
              </View>

              <TouchableOpacity style={styles.doneButton} onPress={onClose}>
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 18,
    color: '#666',
  },
  content: {
    padding: 20,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  referenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  referenceIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  referenceInfo: {
    flex: 1,
  },
  referenceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  referenceSize: {
    fontSize: 12,
    color: '#007AFF',
    marginBottom: 2,
  },
  referenceDesc: {
    fontSize: 11,
    color: '#999',
  },
  arrow: {
    fontSize: 20,
    color: '#999',
  },
  customSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
  },
  customTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  customHint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  inputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    fontSize: 16,
  },
  customButton: {
    backgroundColor: '#D97706',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  customButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  selectedCard: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    marginBottom: 20,
  },
  selectedIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  selectedName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  selectedSize: {
    fontSize: 14,
    color: '#007AFF',
  },
  instructions: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  hint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 12,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  backButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
    alignItems: 'center',
  },
  backText: {
    color: '#666',
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    marginLeft: 8,
    alignItems: 'center',
  },
  confirmText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  resultCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  success: {
    backgroundColor: '#D1FAE5',
  },
  error: {
    backgroundColor: '#FEE2E2',
  },
  resultIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  resultStats: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16,
  },
  resultStat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  resultHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  doneButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

