/**
 * Shown when saving the scanned room fails ("Design a room" auto-saves it under the
 * project name). The user can rename and retry, or skip and keep the scanned size.
 * RN TextInput because the Unity keyboard does not work in UaaL.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { RoomConfirmedPayload } from '@/types/unity-bridge';
import { spacing, radii } from '@/components/ui/theme';

interface RoomMeasurementSaveModalProps {
  visible: boolean;
  payload: RoomConfirmedPayload | null;
  saving: boolean;
  error: string | null;
  roomName: string;
  onChangeRoomName: (name: string) => void;
  onSave: () => void;
  /** Continue to preferences with the scanned size, without saving the room. */
  onSkip: () => void;
}

export function RoomMeasurementSaveModal({
  visible,
  payload,
  saving,
  error,
  roomName,
  onChangeRoomName,
  onSave,
  onSkip,
}: RoomMeasurementSaveModalProps) {
  const dimensionText =
    payload?.dimensionLabel?.trim() ||
    (payload && payload.width > 0
      ? `L ${payload.depth.toFixed(1)}m × W ${payload.width.toFixed(1)}m × H ${payload.height.toFixed(1)}m`
      : '');

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
      onRequestClose={saving ? undefined : onSkip}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Enter room&apos;s name</Text>

          <TextInput
            value={roomName}
            onChangeText={onChangeRoomName}
            placeholder="Living room"
            placeholderTextColor="#9CA3AF"
            maxLength={100}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={saving ? undefined : onSave}
            editable={!saving}
            style={styles.nameInput}
            accessibilityLabel="Room name"
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {dimensionText ? <Text style={styles.dims}>{dimensionText}</Text> : null}
          {floorAreaText ? <Text style={styles.subtitle}>{floorAreaText}</Text> : null}

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.skipButton}
              onPress={onSkip}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Skip saving and continue"
            >
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={onSave}
              disabled={saving || !payload}
              accessibilityRole="button"
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save room</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1B19',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  nameInput: {
    width: '100%',
    borderRadius: radii.md,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
    color: '#1C1B19',
    marginBottom: spacing.sm,
  },
  dims: {
    fontSize: 14,
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  skipButton: {
    flex: 0.38,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '700',
  },
  saveButton: {
    flex: 0.62,
    backgroundColor: '#2563EB',
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.75,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
