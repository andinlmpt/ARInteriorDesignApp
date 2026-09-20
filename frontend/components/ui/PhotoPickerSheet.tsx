/**
 * Bottom-sheet photo actions — camera, library, optional remove.
 * Prefer this over AppDialog for multi-option pickers.
 */

import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui/Text';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, radii } from '@/components/ui/theme';

export interface PhotoPickerSheetProps {
  visible: boolean;
  hasPhoto?: boolean;
  onClose: () => void;
  onTakePhoto: () => void;
  onChooseLibrary: () => void;
  onRemovePhoto?: () => void;
}

type Option = {
  key: string;
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
};

export function PhotoPickerSheet({
  visible,
  hasPhoto = false,
  onClose,
  onTakePhoto,
  onChooseLibrary,
  onRemovePhoto,
}: PhotoPickerSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const options: Option[] = [
    {
      key: 'camera',
      label: 'Take photo',
      subtitle: 'Use your camera',
      icon: 'camera-outline',
      onPress: onTakePhoto,
    },
    {
      key: 'library',
      label: 'Choose from library',
      subtitle: 'Pick an existing image',
      icon: 'images-outline',
      onPress: onChooseLibrary,
    },
  ];

  if (hasPhoto && onRemovePhoto) {
    options.push({
      key: 'remove',
      label: 'Remove photo',
      subtitle: 'Use your initials instead',
      icon: 'trash-outline',
      onPress: onRemovePhoto,
      destructive: true,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfacePrimary,
              paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.handle, { backgroundColor: colors.outline }]} />

          <View style={styles.header}>
            <AppText variant="h3" weight="700" style={{ color: colors.textPrimary }}>
              Update photo
            </AppText>
            <AppText variant="body" style={[styles.subtitle, { color: colors.textSecondary }]}>
              Add a clear photo so others can recognize you.
            </AppText>
          </View>

          <View
            style={[
              styles.optionGroup,
              { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
            ]}
          >
            {options.map((option, index) => {
              const isLast = index === options.length - 1;
              const iconBg = option.destructive ? `${colors.danger}18` : colors.accentSoft;
              const iconColor = option.destructive ? colors.danger : colors.accent;
              const labelColor = option.destructive ? colors.danger : colors.textPrimary;

              return (
                <React.Fragment key={option.key}>
                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={option.onPress}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                  >
                    <View style={[styles.iconPill, { backgroundColor: iconBg }]}>
                      <Ionicons name={option.icon} size={20} color={iconColor} />
                    </View>
                    <View style={styles.optionCopy}>
                      <AppText variant="subtitle" weight="600" style={{ color: labelColor }}>
                        {option.label}
                      </AppText>
                      <AppText variant="caption" style={{ color: colors.textMuted }}>
                        {option.subtitle}
                      </AppText>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                  {!isLast ? (
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  ) : null}
                </React.Fragment>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: colors.border }]}
            onPress={onClose}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <AppText variant="subtitle" weight="600" style={{ color: colors.textSecondary }}>
              Cancel
            </AppText>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.lg,
  },
  header: {
    marginBottom: spacing.lg,
  },
  subtitle: {
    marginTop: spacing.xs,
    lineHeight: 22,
  },
  optionGroup: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 64,
  },
  iconPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCopy: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 40 + spacing.md + spacing.md,
  },
  cancelBtn: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
});

export default PhotoPickerSheet;
