import React, { useState, forwardRef, useImperativeHandle, useRef } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

interface AIDesignChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export interface AIDesignChatInputRef {
  focus: () => void;
  clear: () => void;
}

export const AIDesignChatInput = forwardRef<AIDesignChatInputRef, AIDesignChatInputProps>(
  ({ onSend, disabled }, ref) => {
    const [text, setText] = useState('');
    const { colors } = useTheme();
    const inputRef = useRef<TextInput>(null);

    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus();
      },
      clear: () => {
        setText('');
      }
    }));

    const handleSend = () => {
      if (!text.trim() || disabled) return;
      onSend(text.trim());
      setText('');
    };

    return (
      <View style={[styles.container, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <View style={[styles.inputWrapper, { backgroundColor: colors.surfacePrimary, borderColor: colors.border }]}>
          <TextInput
            ref={inputRef}
            placeholder="Describe your dream room..."
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.textPrimary }]}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
            editable={!disabled}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!text.trim() || disabled}
            style={[
              styles.sendButton,
              {
                backgroundColor: text.trim() && !disabled ? colors.accent : colors.surfaceSecondary,
              },
            ]}
          >
            <Ionicons
              name="arrow-up"
              size={18}
              color={text.trim() && !disabled ? '#FFFFFF' : colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }
);
export default AIDesignChatInput;
