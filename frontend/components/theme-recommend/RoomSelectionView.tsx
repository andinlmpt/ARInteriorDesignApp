import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { RoomType } from '@/types/theme-recommendation';

interface OptionCardProps {
  value: string;
  emoji: string;
  label: string;
  isSelected: boolean;
  hasFeedback: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}

const OptionCard: React.FC<OptionCardProps> = ({ 
  value, 
  emoji, 
  label, 
  isSelected, 
  hasFeedback, 
  onPress, 
  accessibilityLabel 
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.optionCard,
        isSelected && styles.optionCardSelected,
        hasFeedback && styles.optionCardFeedback,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: isSelected }}
    >
      <Text style={styles.optionEmoji}>{emoji}</Text>
      <Text style={styles.optionText}>{label}</Text>
      {isSelected && <Text style={styles.optionCheckmark}>✓</Text>}
    </TouchableOpacity>
  );
};

interface RoomSelectionViewProps {
  selectedRoom: RoomType | null;
  onSelect: (room: RoomType) => void;
  onBack: () => void;
  roomTypes: readonly RoomType[];
  roomEmojis: Record<RoomType, string>;
  selectionFeedback: { type: 'room'; value: string } | null;
  historyLoaded: boolean;
  recentThemes: any[];
  filteredAndSortedHistory: any[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onImageUpload?: () => void;
  onTakePhoto?: () => void;
  uploadedImage: string | null;
  isAnalyzingImage: boolean;
  imageAnalysisResult: any;
  styles: any;
}

export const RoomSelectionView: React.FC<RoomSelectionViewProps> = ({
  selectedRoom,
  onSelect,
  onBack,
  roomTypes,
  roomEmojis,
  selectionFeedback,
  historyLoaded,
  recentThemes,
  filteredAndSortedHistory,
  searchQuery,
  onSearchChange,
  onImageUpload,
  onTakePhoto,
  uploadedImage,
  isAnalyzingImage,
  imageAnalysisResult,
  styles: parentStyles,
}) => {
  return (
    <View style={parentStyles.container} accessibilityLabel="Room selection screen">
      <StatusBar style="dark" />
      <View style={parentStyles.header}>
        <TouchableOpacity 
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={parentStyles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={parentStyles.title} accessibilityRole="header">Theme Finder</Text>
        <View style={parentStyles.headerActions}>
          {/* Header actions can be added here */}
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        accessibilityLabel="Room selection options"
      >
        <View style={parentStyles.content}>
          <View style={parentStyles.progressIndicator}>
            <View style={parentStyles.stepperRow}>
              <View style={[parentStyles.stepperDot, parentStyles.stepperDotActive]} />
              <View style={parentStyles.stepperConnector} />
              <View style={parentStyles.stepperDot} />
              <View style={parentStyles.stepperConnector} />
              <View style={parentStyles.stepperDot} />
            </View>
            <Text style={parentStyles.stepNumber}>Step 1 · Choose room</Text>
          </View>

          {historyLoaded && recentThemes.length > 0 && (
            <View style={parentStyles.historyCard}>
              <View style={parentStyles.historyHeader}>
                <Text style={parentStyles.historyTitle}>Recently loved themes</Text>
                <Text style={parentStyles.historyCount}>{recentThemes.length} saved</Text>
              </View>
              {/* History list can be rendered here */}
            </View>
          )}

          <Text style={parentStyles.question} accessibilityRole="header">
            Which room are you designing?
          </Text>
          <View style={parentStyles.optionsGrid}>
            {roomTypes.map((room) => (
              <OptionCard
                key={room}
                value={room}
                emoji={roomEmojis[room]}
                label={room}
                isSelected={selectedRoom === room}
                hasFeedback={selectionFeedback?.type === 'room' && selectionFeedback.value === room}
                onPress={() => onSelect(room)}
                accessibilityLabel={`Select ${room}`}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    minHeight: 120,
  },
  optionCardSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  optionCardFeedback: {
    borderColor: '#34C759',
  },
  optionEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  optionCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    fontSize: 20,
    color: '#007AFF',
    fontWeight: 'bold',
  },
});


