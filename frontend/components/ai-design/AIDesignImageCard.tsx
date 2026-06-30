import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { savedItemsService } from '../../services/SavedItemsService';

interface AIDesignImageCardProps {
  imageUrl: string;
  prompt: string;
  onSave: () => void;
  onEdit: () => void;
}

export function AIDesignImageCard({ imageUrl, prompt, onSave, onEdit }: AIDesignImageCardProps) {
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    let active = true;
    const checkSaved = async () => {
      try {
        const cleanPrompt = prompt.trim();
        const hashString = (str: string): string => {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash |= 0;
          }
          return Math.abs(hash).toString(36);
        };
        const designId = `design_${hashString(cleanPrompt)}`;
        const saved = await savedItemsService.isItemSaved(designId);
        if (active) {
          setIsSaved(saved);
        }
      } catch (err) {
        console.warn('[ImageCard] Error checking save state:', err);
      }
    };
    checkSaved();
    return () => {
      active = false;
    };
  }, [imageUrl, prompt]);

  const handleSavePress = () => {
    onSave();
    setIsSaved(prev => !prev);
  };

  return (
    <View style={styles.card}>
      <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
      
      {/* Floating Edit Button (Bottom Left) */}
      <TouchableOpacity
        style={[styles.floatingButton, styles.editButton]}
        onPress={onEdit}
        activeOpacity={0.8}
      >
        <Text style={styles.editButtonText}>Edit</Text>
      </TouchableOpacity>

      {/* Floating Save Button (Bottom Right) */}
      <TouchableOpacity
        style={[styles.floatingButton, styles.saveButton]}
        onPress={handleSavePress}
        activeOpacity={0.8}
      >
        <Ionicons
          name={isSaved ? "heart" : "heart-outline"}
          size={20}
          color={isSaved ? "#E74C3C" : "#FFFFFF"}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    marginVertical: 10,
    width: '94%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
    aspectRatio: 4 / 3,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 16,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  editButton: {
    left: 16,
    paddingHorizontal: 22,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  saveButton: {
    right: 16,
    width: 40,
  },
});
export default AIDesignImageCard;
