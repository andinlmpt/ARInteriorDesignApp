/**
 * AR View Permission Gate
 * Shown when camera permission has not been granted.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedButton } from '@/components/interactive';
import { colors } from '@/components/ui/theme';
import { styles } from '@/styles/arView.styles';

interface ARViewPermissionGateProps {
  onRequestPermission: () => void;
}

export function ARViewPermissionGate({ onRequestPermission }: ARViewPermissionGateProps) {
  return (
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
        onPress={onRequestPermission}
        accessibilityRole="button"
        accessibilityLabel="Grant camera permission"
        hapticType="success"
      >
        <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
        <Text style={styles.permissionButtonText}>Grant Permission</Text>
      </AnimatedButton>
    </View>
  );
}
