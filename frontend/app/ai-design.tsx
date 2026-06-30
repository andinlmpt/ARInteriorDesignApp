import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/contexts/ThemeContext';
import { useAIDesignChat } from '@/hooks/useAIDesignChat';
import { AIDesignChatInput } from '@/components/ai-design/AIDesignChatInput';
import { AIDesignMessageBubble } from '@/components/ai-design/AIDesignMessageBubble';
import { AIDesignSuggestionChips } from '@/components/ai-design/AIDesignSuggestionChips';
import { savedItemsService } from '@/services/SavedItemsService';

export default function AIDesignScreen() {
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();
  const params = useLocalSearchParams<{ themeName?: string; roomDataJson?: string }>();
  const flatListRef = useRef<FlatList>(null);

  const {
    messages,
    isPending,
    sendMessage,
    resetChat,
  } = useAIDesignChat();

  // Prefill prompt on entry parameters
  useEffect(() => {
    const handleInitialParams = async () => {
      if (params.themeName) {
        const prefilledPrompt = `Design a ${params.themeName} inspired room`;
        await sendMessage(prefilledPrompt);
      }
      
      if (params.roomDataJson) {
        try {
          const room = JSON.parse(params.roomDataJson);
          if (room && room.dimensions) {
            const dimsText = `${room.dimensions.width}x${room.dimensions.length}m`;
            const obsText = room.obstacles && room.obstacles.length > 0
              ? ` with obstacles: ${room.obstacles.map((o: any) => o.type).join(', ')}`
              : '';
            const prefilledPrompt = `Design a ${room.roomType || 'Living Room'} of dimensions ${dimsText}${obsText}`;
            await sendMessage(prefilledPrompt);
          }
        } catch (err) {
          console.warn('[Chat] Failed to parse roomDataJson from navigation params:', err);
        }
      }
    };

    resetChat();

    const timer = setTimeout(() => {
      handleInitialParams();
    }, 300);

    return () => clearTimeout(timer);
  }, [params.themeName, params.roomDataJson]);

  // Auto-scroll list to bottom
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSaveImage = async (imageUrl: string, prompt: string) => {
    try {
      // Use clean deterministic design ID based on prompt hash
      const cleanPrompt = prompt.trim();
      const designId = `design_${Buffer.from(cleanPrompt.substring(0, 60)).toString('base64').substring(0, 16)}`;
      const isSaved = await savedItemsService.isItemSaved(designId);
      if (isSaved) {
        await savedItemsService.removeItem(designId);
        Alert.alert('Removed', 'Design removed from your saved items.');
      } else {
        await savedItemsService.saveItem({
          id: designId,
          name: cleanPrompt.substring(0, 30) + (cleanPrompt.length > 30 ? '...' : ''),
          type: 'design',
          imageUrl: imageUrl,
          description: cleanPrompt,
          metadata: {
            prompt: cleanPrompt,
            savedAt: Date.now()
          }
        });
        Alert.alert('Saved', 'Design saved to your saved items!');
      }
    } catch (err) {
      console.error('Failed to toggle save on design image:', err);
    }
  };

  const showSuggestionChips = messages.length <= 1 && !isPending;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />

      {/* Pinned Header */}
      <View style={[styles.header, { backgroundColor: colors.surfacePrimary, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Text style={[styles.headerBtnText, { color: colors.accent }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>AI Design Assistant</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={resetChat}>
          <Text style={[styles.headerBtnText, { color: colors.textMuted }]}>Reset</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Chat List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <AIDesignMessageBubble
              message={item}
              onSaveImage={handleSaveImage}
            />
          )}
          contentContainerStyle={[styles.threadContent, showSuggestionChips && { justifyContent: 'center', flexGrow: 1 }]}
          ListFooterComponent={showSuggestionChips ? (
            <AIDesignSuggestionChips onSelect={sendMessage} />
          ) : null}
        />

        {/* Input Bar */}
        <AIDesignChatInput onSend={sendMessage} disabled={isPending} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerBtn: {
    minWidth: 60,
  },
  headerBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  keyboardContainer: {
    flex: 1,
  },
  threadContent: {
    paddingVertical: 12,
  },
});
