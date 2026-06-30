import { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ChatMessage, PromptAnalysis, ChatGeneratedLayout } from '../types/ai-design-chat';
import { ideaAssistantService } from '../services/IdeaAssistantService';
import { DesignImageGenerationService } from '../services/DesignImageGenerationService';
import { callApi } from '../services/apiClient';

const DEFAULT_DIMENSIONS: Record<string, { width: number; length: number; height: number }> = {
  'Bedroom': { width: 4.5, length: 5.0, height: 2.7 },
  'Living Room': { width: 5.0, length: 6.0, height: 2.7 },
  'Kitchen': { width: 3.5, length: 4.0, height: 2.7 },
  'Bathroom': { width: 2.5, length: 3.0, height: 2.4 },
  'Office': { width: 3.0, length: 4.0, height: 2.7 },
  'Dining Room': { width: 4.0, length: 5.0, height: 2.7 },
};

export function useAIDesignChat(token: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<Record<string, string>>({});
  const [isGeneratingImage, setIsGeneratingImage] = useState<Record<string, boolean>>({});
  const currentIntentRef = useRef<PromptAnalysis | null>(null);

  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const removeLoadingMessage = useCallback(() => {
    setMessages(prev => prev.filter(m => m.type !== 'loading'));
  }, []);

  const handleGenerateImage = useCallback(async (layout: ChatGeneratedLayout, roomType: string, style: string, width: number, depth: number) => {
    if (generatedImages[layout.id] || isGeneratingImage[layout.id]) return;

    setIsGeneratingImage(prev => ({ ...prev, [layout.id]: true }));
    try {
      const imageService = new DesignImageGenerationService();
      
      const proposal = {
        id: layout.id,
        title: `${style} ${roomType}`,
        description: `A ${style} design for a ${width}x${depth}m ${roomType}.`,
        layout: {
          id: layout.id,
          version: 1,
          furniture: layout.furniture.map((item, index) => ({
            id: item.id || `f_${index}`,
            type: item.type || 'other',
            category: item.category || 'other',
            name: item.name || 'Furniture Item',
            dimensions: item.dimensions || { width: 1, length: 1, height: 1 },
            position: item.position || { x: 0, y: 0, z: 0, rotation: 0 },
            properties: item.properties || {},
            zIndex: item.zIndex || 0
          })),
          metadata: {
            generatedAt: Date.now(),
            algorithm: 'genetic' as const,
            iterationsCount: 100
          }
        }
      };

      const preferences = {
        roomType: roomType.toLowerCase(),
        style: style.toLowerCase(),
        colors: [],
        budget: 'medium' as const,
        quality: 'standard' as const,
        imageStyle: 'photorealistic' as const,
      };

      const result = await imageService.generateDesignImage(proposal, preferences);

      if (result && result.imageUrl) {
        setGeneratedImages(prev => ({ ...prev, [layout.id]: result.imageUrl! }));
      } else {
        throw new Error('Image generation failed');
      }
    } catch (error) {
      console.warn('[Chat] Failed to generate 3D image render:', error);
    } finally {
      setIsGeneratingImage(prev => ({ ...prev, [layout.id]: false }));
    }
  }, [generatedImages, isGeneratingImage]);

  const generateLayouts = useCallback(async (analysis: PromptAnalysis) => {
    setIsPending(true);
    const loadingId = Math.random().toString();
    appendMessage({
      id: loadingId,
      role: 'assistant',
      type: 'loading',
      label: 'AI is generating layouts and 3D preview renders...',
      createdAt: Date.now()
    });

    const roomType = analysis.roomType || 'Living Room';
    const style = analysis.style || 'Modern';
    const dims = analysis.dimensions || DEFAULT_DIMENSIONS[roomType] || DEFAULT_DIMENSIONS['Living Room'];

    try {
      const body = {
        roomDimensions: {
          width: dims.width,
          height: dims.height,
          depth: dims.length, // note: length maps to depth in backend
        },
        detectedObstacles: analysis.obstacles || [],
        availableFloorSpace: dims.width * dims.length * 0.75,
        roomType,
        style,
      };

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const layoutsResult = await callApi<ChatGeneratedLayout[]>('/design/generate', {
        method: 'POST',
        body,
        headers
      });

      removeLoadingMessage();

      if (layoutsResult && Array.isArray(layoutsResult) && layoutsResult.length > 0) {
        appendMessage({
          id: Math.random().toString(),
          role: 'assistant',
          type: 'layouts',
          layouts: layoutsResult,
          dimensions: {
            width: dims.width,
            depth: dims.length,
            height: dims.height
          },
          createdAt: Date.now()
        });

        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Pre-trigger image generations in background
        layoutsResult.forEach(layout => {
          void handleGenerateImage(layout, roomType, style, dims.width, dims.length);
        });
      } else {
        throw new Error('No layouts returned from generator');
      }
    } catch (error: any) {
      console.error('[Chat] Layout generation failed:', error);
      removeLoadingMessage();
      appendMessage({
        id: Math.random().toString(),
        role: 'assistant',
        type: 'error',
        message: error.message || 'Failed to generate layouts. Please try again.',
        createdAt: Date.now()
      });
    } finally {
      setIsPending(false);
    }
  }, [token, appendMessage, removeLoadingMessage, handleGenerateImage]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text || !text.trim() || isPending) return;

    const trimmed = text.trim();
    appendMessage({
      id: Math.random().toString(),
      role: 'user',
      text: trimmed,
      createdAt: Date.now()
    });

    setIsPending(true);
    const loadingId = Math.random().toString();
    appendMessage({
      id: loadingId,
      role: 'assistant',
      type: 'loading',
      label: 'Understanding your request...',
      createdAt: Date.now()
    });

    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const analysis = await ideaAssistantService.analyzePrompt(trimmed);
      removeLoadingMessage();

      // Check if we parsed roomType or style. Fall back if completely empty
      if (!analysis.roomType && !analysis.style) {
        appendMessage({
          id: Math.random().toString(),
          role: 'assistant',
          type: 'text',
          text: "I couldn't quite extract the room type or style from your prompt. Tell me a bit more, like: 'Modern living room' or 'Scandinavian bedroom 4x5m'.",
          createdAt: Date.now()
        });
        setIsPending(false);
        return;
      }

      // Populate default dimensions based on detected roomType
      const detectedRoomType = analysis.roomType || 'Living Room';
      if (!analysis.dimensions) {
        analysis.dimensions = DEFAULT_DIMENSIONS[detectedRoomType] || DEFAULT_DIMENSIONS['Living Room'];
      }

      currentIntentRef.current = analysis;

      appendMessage({
        id: Math.random().toString(),
        role: 'assistant',
        type: 'intent',
        analysis,
        createdAt: Date.now()
      });

    } catch (error: any) {
      console.warn('[Chat] Analysis error:', error);
      removeLoadingMessage();
      appendMessage({
        id: Math.random().toString(),
        role: 'assistant',
        type: 'error',
        message: 'Could not understand that. Please try rephrasing or checking your connection.',
        createdAt: Date.now()
      });
    } finally {
      setIsPending(false);
    }
  }, [isPending, appendMessage, removeLoadingMessage]);

  const updateIntent = useCallback((updated: PromptAnalysis) => {
    currentIntentRef.current = updated;
    // Replace the last intent message with the updated one
    setMessages(prev => {
      const idx = prev.map(m => m.type).lastIndexOf('intent');
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          analysis: updated
        } as any;
        return copy;
      }
      return prev;
    });
  }, []);

  const resetChat = useCallback(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        type: 'text',
        text: '👋 Hi! I am your AI Design Assistant. Tell me about the room you would like to design (e.g. "Design a cozy Scandinavian bedroom 4x5m with a window on the left").',
        createdAt: Date.now()
      }
    ]);
    setGeneratedImages({});
    setIsGeneratingImage({});
    currentIntentRef.current = null;
  }, []);

  return {
    messages,
    isPending,
    generatedImages,
    isGeneratingImage,
    sendMessage,
    generateLayouts,
    updateIntent,
    resetChat,
    handleGenerateImage
  };
}
