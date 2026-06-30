import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { ChatMessage } from '../../types/ai-design-chat';
import { AIDesignImageCard } from './AIDesignImageCard';

interface AIDesignMessageBubbleProps {
  message: ChatMessage;
  onSaveImage: (imageUrl: string, prompt: string) => void;
}

export function AIDesignMessageBubble({
  message,
  onSaveImage,
}: AIDesignMessageBubbleProps) {
  const { colors } = useTheme();
  const isUser = message.role === 'user';

  if (message.type === 'image') {
    return (
      <AIDesignImageCard
        imageUrl={message.imageUrl || ''}
        prompt={message.prompt || ''}
        onSave={() => onSaveImage(message.imageUrl || '', message.prompt || '')}
      />
    );
  }

  if (message.type === 'loading') {
    return (
      <View style={styles.loadingBubble}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          {message.label}
        </Text>
      </View>
    );
  }

  if (message.type === 'error') {
    return (
      <View style={[styles.errorBubble, { backgroundColor: '#FADBD8', borderColor: '#E74C3C' }]}>
        <Text style={[styles.errorText, { color: '#C0392B' }]}>
          ⚠️ {message.message}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleWrapper, isUser ? styles.userWrapper : styles.assistantWrapper]}>
      <View
        style={[
          styles.bubble,
          isUser
            ? { backgroundColor: colors.accent }
            : { backgroundColor: colors.surfacePrimary, borderColor: colors.border, borderWidth: 1 },
        ]}
      >
        <Text
          style={[
            styles.text,
            isUser ? { color: '#FFFFFF' } : { color: colors.textPrimary },
          ]}
        >
          {message.text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubbleWrapper: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: 16,
  },
  userWrapper: {
    justifyContent: 'flex-end',
  },
  assistantWrapper: {
    justifyContent: 'flex-start',
  },
  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    maxWidth: '80%',
  },
  text: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginVertical: 8,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  errorBubble: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 8,
    width: '90%',
    alignSelf: 'center',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
  },
});
