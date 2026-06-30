import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { PromptAnalysis } from '../../types/ai-design-chat';

interface AIDesignIntentCardProps {
  analysis: PromptAnalysis;
  onConfirm: () => void;
  onUpdate: (updated: PromptAnalysis) => void;
  disabled?: boolean;
}

const ROOM_TYPES = ['Bedroom', 'Living Room', 'Kitchen', 'Bathroom', 'Office', 'Dining Room'];
const STYLE_OPTIONS = ['Minimalist', 'Modern', 'Traditional', 'Scandinavian', 'Industrial', 'Bohemian', 'Contemporary'];

export function AIDesignIntentCard({ analysis, onConfirm, onUpdate, disabled }: AIDesignIntentCardProps) {
  const { colors } = useTheme();
  const [isEditing, setIsEditing] = useState(false);

  // Edit states
  const [roomType, setRoomType] = useState(analysis.roomType || 'Living Room');
  const [style, setStyle] = useState(analysis.style || 'Modern');
  const [width, setWidth] = useState(analysis.dimensions?.width?.toString() || '5.0');
  const [length, setLength] = useState(analysis.dimensions?.length?.toString() || '6.0');
  const [height, setHeight] = useState(analysis.dimensions?.height?.toString() || '2.7');
  const [selectedObstacles, setSelectedObstacles] = useState<string[]>(analysis.obstacles || []);

  const handleSave = () => {
    const updated: PromptAnalysis = {
      roomType,
      style,
      dimensions: {
        width: parseFloat(width) || 5.0,
        length: parseFloat(length) || 6.0,
        height: parseFloat(height) || 2.7,
      },
      obstacles: selectedObstacles,
    };
    onUpdate(updated);
    setIsEditing(false);
  };

  const toggleObstacle = (obs: string) => {
    if (selectedObstacles.includes(obs)) {
      setSelectedObstacles(prev => prev.filter(o => o !== obs));
    } else {
      setSelectedObstacles(prev => [...prev, obs]);
    }
  };

  if (isEditing) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surfacePrimary, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Edit Room Parameters</Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Room Type</Text>
        <View style={styles.chipRow}>
          {ROOM_TYPES.map(type => (
            <TouchableOpacity
              key={type}
              style={[
                styles.chip,
                {
                  backgroundColor: roomType === type ? colors.accent : colors.surfaceSecondary,
                  borderColor: roomType === type ? colors.accent : colors.border,
                },
              ]}
              onPress={() => setRoomType(type)}
            >
              <Text style={[styles.chipText, { color: roomType === type ? '#FFFFFF' : colors.textPrimary }]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Design Style</Text>
        <View style={styles.chipRow}>
          {STYLE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt}
              style={[
                styles.chip,
                {
                  backgroundColor: style === opt ? colors.accent : colors.surfaceSecondary,
                  borderColor: style === opt ? colors.accent : colors.border,
                },
              ]}
              onPress={() => setStyle(opt)}
            >
              <Text style={[styles.chipText, { color: style === opt ? '#FFFFFF' : colors.textPrimary }]}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Dimensions (meters)</Text>
        <View style={styles.dimRow}>
          <View style={styles.dimInputWrapper}>
            <Text style={[styles.dimLabel, { color: colors.textMuted }]}>Width</Text>
            <TextInput
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
              value={width}
              onChangeText={setWidth}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.dimInputWrapper}>
            <Text style={[styles.dimLabel, { color: colors.textMuted }]}>Length</Text>
            <TextInput
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
              value={length}
              onChangeText={setLength}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.dimInputWrapper}>
            <Text style={[styles.dimLabel, { color: colors.textMuted }]}>Height</Text>
            <TextInput
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
              value={height}
              onChangeText={setHeight}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Obstacles</Text>
        <View style={styles.chipRow}>
          {['door', 'window', 'pillar', 'fireplace'].map(obs => (
            <TouchableOpacity
              key={obs}
              style={[
                styles.chip,
                {
                  backgroundColor: selectedObstacles.includes(obs) ? colors.accent : colors.surfaceSecondary,
                  borderColor: selectedObstacles.includes(obs) ? colors.accent : colors.border,
                },
              ]}
              onPress={() => toggleObstacle(obs)}
            >
              <Text style={[styles.chipText, { color: selectedObstacles.includes(obs) ? '#FFFFFF' : colors.textPrimary }]}>
                {obs.charAt(0).toUpperCase() + obs.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.accent }]}
            onPress={handleSave}
          >
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: colors.border }]}
            onPress={() => setIsEditing(false)}
          >
            <Text style={[styles.cancelBtnText, { color: colors.textPrimary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const currentDims = analysis.dimensions || { width: 5.0, length: 6.0, height: 2.7 };

  return (
    <View style={[styles.card, { backgroundColor: colors.surfacePrimary, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>📐 Design Parameters Confirmed</Text>
      
      <View style={styles.metaGrid}>
        <View style={styles.metaCol}>
          <Text style={[styles.metaLabel, { color: colors.textMuted }]}>ROOM TYPE</Text>
          <Text style={[styles.metaVal, { color: colors.textPrimary }]}>{analysis.roomType || 'Living Room'}</Text>
        </View>
        <View style={styles.metaCol}>
          <Text style={[styles.metaLabel, { color: colors.textMuted }]}>STYLE</Text>
          <Text style={[styles.metaVal, { color: colors.textPrimary }]}>{analysis.style || 'Modern'}</Text>
        </View>
      </View>

      <View style={styles.metaGrid}>
        <View style={styles.metaCol}>
          <Text style={[styles.metaLabel, { color: colors.textMuted }]}>DIMENSIONS</Text>
          <Text style={[styles.metaVal, { color: colors.textPrimary }]}>
            {currentDims.width}m × {currentDims.length}m × {currentDims.height}m
          </Text>
        </View>
        <View style={styles.metaCol}>
          <Text style={[styles.metaLabel, { color: colors.textMuted }]}>OBSTACLES</Text>
          <Text style={[styles.metaVal, { color: colors.textPrimary }]}>
            {analysis.obstacles && analysis.obstacles.length > 0
              ? analysis.obstacles.map(o => o.charAt(0).toUpperCase() + o.slice(1)).join(', ')
              : 'None'}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.confirmBtn, { backgroundColor: colors.accent }]}
        disabled={disabled}
        onPress={onConfirm}
      >
        <Text style={styles.confirmBtnText}>✨ Confirm & Generate Layouts</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.editBtn, { borderColor: colors.border }]}
        disabled={disabled}
        onPress={() => setIsEditing(true)}
      >
        <Text style={[styles.editBtnText, { color: colors.textPrimary }]}>✏️ Edit Parameters</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 8,
    width: '90%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  metaGrid: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 16,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaVal: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  editBtn: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  editBtnText: {
    fontWeight: '600',
    fontSize: 13,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dimRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  dimInputWrapper: {
    flex: 1,
  },
  dimLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '500',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  saveBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontWeight: '600',
    fontSize: 13,
  },
});
