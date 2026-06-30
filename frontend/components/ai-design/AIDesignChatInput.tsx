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

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingRight: 10,
    paddingVertical: 4,
    maxHeight: 100,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
