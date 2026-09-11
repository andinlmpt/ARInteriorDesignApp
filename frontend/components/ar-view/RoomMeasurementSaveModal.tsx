/**
 * Modal shown after room scan confirm — lets the user save dimensions to MongoDB.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RoomConfirmedPayload } from '@/types/unity-bridge';
import { spacing, radii } from '@/components/ui/theme';

interface RoomMeasurementSaveModalProps {
  visible: boolean;
  payload: RoomConfirmedPayload | null;
  saving: boolean;
  saved: boolean;
  error: string | null;
  onSave: () => void;
  onContinue: () => void;
}

export function RoomMeasurementSaveModal({
  visible,
  payload,
  saving,
  saved,
  error,
  onSave,
  onContinue,
}: RoomMeasurementSaveModalProps) {
  const dimensionText =
    payload?.dimensionLabel?.trim() ||
    (payload && payload.width > 0
      ? `L ${payload.depth.toFixed(1)}m × W ${payload.width.toFixed(1)}m × H ${payload.height.toFixed(1)}m`
      : '—');

  const floorAreaText =
    payload && payload.floorAreaSqm > 0
      ? `${payload.floorAreaSqm.toFixed(1)} m² floor area`
      : '';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={saving ? undefined : onContinue}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={saving ? undefined : onContinue}
          accessibilityRole="button"
          accessibilityLabel="Dismiss save measurement dialog"
        />
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="resize-outline" size={28} color="#2563EB" />
          </View>

          <Text style={styles.title}>Room measured</Text>
          <Text style={styles.dimensions}>{dimensionText}</Text>
          {floorAreaText ? <Text style={styles.subtitle}>{floorAreaText}</Text> : null}

          {saved ? (
            <View style={styles.successRow}>
              <Ionicons name="checkmark-circle" size={18} color="#059669" />
              <Text style={styles.successText}>Saved to MongoDB</Text>
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryButton, (saving || saved) && styles.primaryButtonDisabled]}
            onPress={onSave}
            disabled={saving || saved || !payload}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {saved ? 'Saved' : 'Save measurement'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, saving && styles.secondaryButtonDisabled]}
            onPress={onContinue}
            disabled={saving}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>Continue to furniture</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.xl,
    padding: spacing.lg,
    alignItems: 'center',
    zIndex: 1,
    elevation: 4,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1B19',
    marginBottom: spacing.xs,
  },
  dimensions: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2563EB',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: spacing.md,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  successText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#2563EB',
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryButtonDisabled: {
    opacity: 0.75,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    width: '100%',
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  secondaryButtonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    color: '#4B5563',
    fontSize: 15,
    fontWeight: '600',
  },
});
