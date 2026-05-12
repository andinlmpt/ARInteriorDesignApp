/**
 * AR Status Indicator Component
 * Displays AR tracking status and safety information
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/ui/Text';
import { colors, spacing, radii, shadows } from '@/components/ui/theme';
import type { AnchorStatus } from '@/types/anchor';
import type { PlacementSafetyResult } from '@/types/ar-view';

interface ARStatusIndicatorProps {
  anchorStatus: AnchorStatus;
  placementSafety?: PlacementSafetyResult | null;
  onDismiss?: () => void;
  dismissed?: boolean;
}

export function ARStatusIndicator({
  anchorStatus,
  placementSafety,
  onDismiss,
  dismissed = false,
}: ARStatusIndicatorProps) {
  if (dismissed) return null;

  const getStatusColor = () => {
    if (!anchorStatus.hasLock) {
      return colors.warning;
    }
    if (anchorStatus.quality === 'good') {
      return colors.success;
    }
    if (anchorStatus.quality === 'medium') {
      return colors.warning;
    }
    return colors.danger;
  };

  const getStatusIcon = () => {
    if (!anchorStatus.hasLock) {
      return 'warning-outline';
    }
    if (anchorStatus.quality === 'good') {
      return 'checkmark-circle';
    }
    return 'alert-circle';
  };

  const getSafetyColor = () => {
    if (!placementSafety) return colors.textSecondary;
    if (placementSafety.safetyLevel === 'safe') {
      return colors.success;
    }
    if (placementSafety.safetyLevel === 'warning') {
      return colors.warning;
    }
    return colors.danger;
  };

  return (
    <View style={styles.container}>
      {/* Anchor Status */}
      <View style={[styles.statusCard, { borderLeftColor: getStatusColor() }]}>
        <Ionicons name={getStatusIcon() as any} size={20} color={getStatusColor()} />
        <View style={styles.statusContent}>
          <AppText style={styles.statusTitle}>
            {anchorStatus.hasLock ? 'AR Tracking Active' : 'Scanning Surface...'}
          </AppText>
          {anchorStatus.hints && anchorStatus.hints.length > 0 && (
            <AppText style={styles.statusHint}>
              {anchorStatus.hints[0]}
            </AppText>
          )}
        </View>
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
            <Ionicons name="close" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Placement Safety */}
      {placementSafety && (
        <View style={[styles.safetyCard, { borderLeftColor: getSafetyColor() }]}>
          <Ionicons 
            name={placementSafety.isSafe ? 'checkmark-circle' : 'alert-circle'} 
            size={20} 
            color={getSafetyColor()} 
          />
          <View style={styles.safetyContent}>
            <AppText style={styles.safetyTitle}>
              {placementSafety.isSafe ? 'Safe to Place' : 'Placement Warning'}
            </AppText>
            {placementSafety.reason && (
              <AppText style={styles.safetyReason}>
                {placementSafety.reason}
              </AppText>
            )}
            {placementSafety.recommendations && placementSafety.recommendations.length > 0 && (
              <AppText style={styles.safetyRecommendation}>
                {placementSafety.recommendations[0]}
              </AppText>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: spacing.md,
    right: spacing.md,
    gap: spacing.sm,
    zIndex: 100,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    padding: spacing.md,
    borderRadius: radii.md,
    borderLeftWidth: 4,
    gap: spacing.sm,
    ...shadows.lg,
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  statusHint: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  dismissButton: {
    padding: spacing.xs,
  },
  safetyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    padding: spacing.md,
    borderRadius: radii.md,
    borderLeftWidth: 4,
    gap: spacing.sm,
    ...shadows.lg,
  },
  safetyContent: {
    flex: 1,
  },
  safetyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  safetyReason: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  safetyRecommendation: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});


