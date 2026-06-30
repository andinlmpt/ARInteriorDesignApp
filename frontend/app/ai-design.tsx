import React, { useEffect, useRef, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { useAIDesignChat } from '@/hooks/useAIDesignChat';
import { AIDesignChatInput } from '@/components/ai-design/AIDesignChatInput';
import { AIDesignMessageBubble } from '@/components/ai-design/AIDesignMessageBubble';
import { AIDesignSuggestionChips } from '@/components/ai-design/AIDesignSuggestionChips';
import { ChatGeneratedLayout } from '@/types/ai-design-chat';
import { savedItemsService } from '@/services/SavedItemsService';

export default function AIDesignScreen() {
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();
  const params = useLocalSearchParams<{ themeName?: string; roomDataJson?: string }>();
  
  const [token, setToken] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Initialize token
  useEffect(() => {
    const fetchToken = async () => {
      const stored = await AsyncStorage.getItem('auth_token');
      setToken(stored);
    };
    fetchToken();
  }, []);

  const {
    messages,
    isPending,
    generatedImages,
    isGeneratingImage,
    sendMessage,
    generateLayouts,
    updateIntent,
    resetChat,
    handleGenerateImage,
  } = useAIDesignChat(token);

  // Handle entry parameters from theme recommends or spatial mapping scans
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

    // Initialize/reset chat thread
    resetChat();

    // Small delay to allow initial mount before firing automatic parameters prompt
    const timer = setTimeout(() => {
      handleInitialParams();
    }, 300);

    return () => clearTimeout(timer);
  }, [params.themeName, params.roomDataJson]);

  // Auto-scroll flatlist to bottom on new message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleOpenARView = async (layout: ChatGeneratedLayout, dimensions: { width: number; depth: number; height: number }) => {
    // Helper to map abstract AI layout categories to local 3D assets
    const mapToLibraryId = (type: string, name: string): string => {
      const normType = type.toLowerCase();
      const normName = name.toLowerCase();
      
      if (normType.includes('sofa') || normName.includes('sofa')) return 'sofa-modern';
      if (normType.includes('armchair') || normName.includes('chair') || normName.includes('armchair')) return 'accent-chair';
      if (normType.includes('coffee-table') || normName.includes('coffee table')) return 'coffee-table';
      if (normType.includes('side-table') || normName.includes('side table')) return 'side-table';
      if (normType.includes('dining-table') || normName.includes('dining table')) return 'dining-table';
      if (normType.includes('dining-chair') || normName.includes('dining chair')) return 'dining-chair';
      if (normType.includes('bookshelf') || normName.includes('bookshelf')) return 'bookshelf';
      if (normType.includes('tv-stand') || normName.includes('tv stand') || normName.includes('tv console')) return 'tv-stand';
      if (normType.includes('wardrobe') || normName.includes('wardrobe')) return 'wardrobe';
      if (normType.includes('floor-lamp') || normName.includes('floor lamp')) return 'floor-lamp';
      if (normType.includes('table-lamp') || normName.includes('table lamp')) return 'table-lamp';
      if (normType.includes('planter') || normName.includes('plant')) return 'planter';
      if (normType.includes('mirror') || normName.includes('mirror')) return 'mirror';
      if (normType.includes('bed') || normName.includes('bed')) return 'bed-king';
      if (normType.includes('nightstand') || normName.includes('nightstand')) return 'nightstand';
      
      if (normType.includes('chair')) return 'dining-chair';
      if (normType.includes('table')) return 'side-table';
      if (normType.includes('cabinet') || normType.includes('dresser') || normType.includes('storage')) return 'bookshelf';
      if (normType.includes('lighting')) return 'table-lamp';
      
      return 'accent-chair';
    };

    const savedLayout = {
      name: `AI Design Layout`,
      furniture: layout.furniture.map((item, index) => {
        const libraryId = mapToLibraryId(item.type || '', item.name || '');
        const rotationDegrees = item.rotation || 0;
        const rotationRadians = (rotationDegrees * Math.PI) / 180;
        
        return {
          id: item.id || `f_${index}`,
          libraryId,
          position: {
            x: (item.position?.x ?? (item as any).x ?? 0) - dimensions.width / 2,
            y: 0,
            z: (item.position?.y ?? (item as any).y ?? 0) - dimensions.depth / 2,
          },
          rotation: {
            x: 0,
            y: rotationRadians,
            z: 0,
          }
        };
      }),
      timestamp: Date.now(),
    };

    try {
      // Write selected layout directly to AsyncStorage so ARView screen restores it on initialization
      await AsyncStorage.setItem('ar_current_layout', JSON.stringify(savedLayout));
      
      const roomData = {
        dimensions: {
          width: dimensions.width,
          length: dimensions.depth, // note length/depth mapping in spatial-mapping type definitions
          height: dimensions.height,
        },
        area: dimensions.width * dimensions.depth,
        volume: dimensions.width * dimensions.depth * dimensions.height,
        obstacles: [],
        walls: [],
        floorBoundary: [],
        ceilingBoundary: [],
        confidence: 1.0,
        timestamp: Date.now(),
      };

      router.push({
        pathname: '/ar-view',
        params: {
          roomDataJson: JSON.stringify(roomData),
        },
      });
    } catch (err) {
      console.error('Failed to handoff layout to AR view:', err);
      Alert.alert('AR Navigation Error', 'Failed to transfer room layout coordinates to AR view.');
    }
  };

  const handleSaveDesign = async (layout: ChatGeneratedLayout, roomType: string, style: string) => {
    try {
      const isSaved = await savedItemsService.isItemSaved(layout.id);
      if (isSaved) {
        await savedItemsService.removeItem(layout.id);
        Alert.alert('Removed', 'Layout removed from your saved items.');
      } else {
        await savedItemsService.saveItem({
          id: layout.id,
          name: `AI Generated ${style} ${roomType}`,
          type: 'design',
          imageUrl: generatedImages[layout.id] || '',
          description: `${roomType} layout with safety score of ${layout.score}`,
          metadata: {
            score: layout.score,
            furnitureCount: layout.furniture.length,
            style,
            roomType
          }
        });
        Alert.alert('Saved', 'Layout saved to your saved items!');
      }
    } catch (err) {
      console.error('Failed to toggle save on design layout:', err);
    }
  };

  const showSuggestionChips = messages.length <= 1 && !isPending;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />

      {/* Custom Pinned Header */}
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Chat Thread */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <AIDesignMessageBubble
              message={item}
              onConfirmIntent={() => {
                if (item.type === 'intent') {
                  generateLayouts(item.analysis);
                }
              }}
              onUpdateIntent={updateIntent}
              onOpenARView={(layout) => {
                const idx = messages.map(m => m.type).lastIndexOf('layouts');
                if (idx !== -1) {
                  const layoutMsg = messages[idx] as any;
                  handleOpenARView(layout, layoutMsg.dimensions);
                }
              }}
              onSaveDesign={(layout) => {
                const idx = messages.map(m => m.type).lastIndexOf('layouts');
                if (idx !== -1) {
                  const layoutMsg = messages[idx] as any;
                  const roomType = layoutMsg.analysis?.roomType || 'Room';
                  const style = layoutMsg.analysis?.style || 'Modern';
                  handleSaveDesign(layout, roomType, style);
                }
              }}
              onGenerateImage={(layout) => {
                const idx = messages.map(m => m.type).lastIndexOf('layouts');
                if (idx !== -1) {
                  const layoutMsg = messages[idx] as any;
                  const roomType = layoutMsg.analysis?.roomType || 'Room';
                  const style = layoutMsg.analysis?.style || 'Modern';
                  const dims = layoutMsg.dimensions;
                  handleGenerateImage(layout, roomType, style, dims.width, dims.depth);
                }
              }}
              generatedImages={generatedImages}
              isGeneratingImage={isGeneratingImage}
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
