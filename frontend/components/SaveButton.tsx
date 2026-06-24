/**
 * SaveButton Component
 * Reusable button for saving/unsaving items throughout the app
 */

import { useState, useEffect } from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSaveItem } from '@/hooks/useSaveItem';
import { useTheme } from '@/contexts/ThemeContext';

interface SaveButtonProps {
  itemId: string;
  item: {
    id: string;
    name: string;
    type: 'furniture' | 'design' | 'project' | 'theme';
    price?: string;
    iconName?: string;
    iconColor?: string;
    imageUrl?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  };
  size?: number;
  showLabel?: boolean;
  onSaved?: () => void;
  onUnsaved?: () => void;
}

export function SaveButton({ 
  itemId, 
  item, 
  size = 24, 
  showLabel = false,
  onSaved,
  onUnsaved,
}: SaveButtonProps) {
  const { colors } = useTheme();
  const { saveItem, unsaveItem, checkIfSaved, isSaving, isChecking } = useSaveItem();
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check saved status on mount and when itemId changes
  useEffect(() => {
    let mounted = true;

    async function checkStatus() {
      setIsLoading(true);
      try {
        const saved = await checkIfSaved(itemId);
        if (mounted) {
          setIsSaved(saved);
        }
      } catch (error) {
        console.error('[SaveButton] Failed to check saved status:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    checkStatus();

    return () => {
      mounted = false;
    };
  }, [itemId, checkIfSaved]);

  const handlePress = async () => {
    if (isSaved) {
      const success = await unsaveItem(itemId, item.name, { 
        showAlert: false,
        onUnsaved: () => {
          setIsSaved(false);
          onUnsaved?.();
        },
      });
      if (success) {
        setIsSaved(false);
      }
    } else {
      const success = await saveItem(item, { 
        showAlert: false,
        onSaved: () => {
          setIsSaved(true);
          onSaved?.();
        },
      });
      if (success) {
        setIsSaved(true);
      }
    }
  };

  if (isLoading || isChecking) {
    return (
      <TouchableOpacity 
        style={styles.button}
        disabled
        activeOpacity={0.7}
      >
        <ActivityIndicator size="small" color={colors.accent} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handlePress}
      disabled={isSaving}
      activeOpacity={0.7}
    >
      <Ionicons
        name={isSaved ? 'heart' : 'heart-outline'}
        size={size}
        color={isSaved ? '#EC4899' : colors.textMuted}
      />
      {showLabel && (
        <Text style={[styles.label, { color: isSaved ? '#EC4899' : colors.textMuted }]}>
          {isSaved ? 'Saved' : 'Save'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
});
