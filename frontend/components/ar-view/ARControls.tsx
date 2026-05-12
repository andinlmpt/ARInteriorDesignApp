/**
 * AR Controls Component
 * Control buttons for AR view actions
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/ui/Text';
import { colors, spacing, radii, shadows } from '@/components/ui/theme';

interface ARControlsProps {
  // Actions
  onUndo?: () => void;
  onRedo?: () => void;
  onDelete?: () => void;
  onRotate?: () => void;
  onSave?: () => void;
  onClear?: () => void;
  
  // State
  canUndo?: boolean;
  canRedo?: boolean;
  hasSelection?: boolean;
  isARActive?: boolean;
  
  // Custom buttons
  customButtons?: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    disabled?: boolean;
  }[];
}

export function ARControls({
  onUndo,
  onRedo,
  onDelete,
  onRotate,
  onSave,
  onClear,
  canUndo = false,
  canRedo = false,
  hasSelection = false,
  isARActive = false,
  customButtons = [],
}: ARControlsProps) {
  return (
    <View style={styles.container}>
      {/* Top Controls */}
      <View style={styles.topRow}>
        {onUndo && (
          <TouchableOpacity
            style={[styles.button, !canUndo && styles.buttonDisabled]}
            onPress={onUndo}
            disabled={!canUndo}
          >
            <Ionicons name="arrow-undo" size={20} color={canUndo ? colors.textPrimary : colors.textSecondary} />
          </TouchableOpacity>
        )}
        
        {onRedo && (
          <TouchableOpacity
            style={[styles.button, !canRedo && styles.buttonDisabled]}
            onPress={onRedo}
            disabled={!canRedo}
          >
            <Ionicons name="arrow-redo" size={20} color={canRedo ? colors.textPrimary : colors.textSecondary} />
          </TouchableOpacity>
        )}
        
        {onClear && (
          <TouchableOpacity
            style={styles.button}
            onPress={onClear}
          >
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </TouchableOpacity>
        )}
      </View>

      {/* Selection Controls */}
      {hasSelection && (
        <View style={styles.selectionRow}>
          {onRotate && (
            <TouchableOpacity
              style={styles.button}
              onPress={onRotate}
            >
              <Ionicons name="refresh" size={20} color={colors.accent} />
              <AppText style={styles.buttonLabel}>Rotate</AppText>
            </TouchableOpacity>
          )}
          
          {onDelete && (
            <TouchableOpacity
              style={[styles.button, styles.buttonDanger]}
              onPress={onDelete}
            >
              <Ionicons name="trash" size={20} color={colors.danger} />
              <AppText style={styles.buttonLabel}>Delete</AppText>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Custom Buttons */}
      {customButtons.length > 0 && (
        <View style={styles.customRow}>
          {customButtons.map((button, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.button, button.disabled && styles.buttonDisabled]}
              onPress={button.onPress}
              disabled={button.disabled}
            >
              <Ionicons 
                name={button.icon} 
                size={20} 
                color={button.disabled ? colors.textSecondary : colors.textPrimary} 
              />
              <AppText style={styles.buttonLabel}>{button.label}</AppText>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Save Button */}
      {onSave && (
        <TouchableOpacity
          style={[styles.button, styles.saveButton]}
          onPress={onSave}
        >
          <Ionicons name="save" size={20} color={colors.success} />
          <AppText style={[styles.buttonLabel, styles.saveButtonLabel]}>Save Layout</AppText>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    right: spacing.md,
    gap: spacing.sm,
    zIndex: 100,
  },
  topRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  selectionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    padding: spacing.sm,
    borderRadius: radii.md,
    ...shadows.md,
  },
  customRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  button: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    padding: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
    ...shadows.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  saveButton: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  buttonLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  saveButtonLabel: {
    color: colors.success,
    fontWeight: '600',
  },
});


