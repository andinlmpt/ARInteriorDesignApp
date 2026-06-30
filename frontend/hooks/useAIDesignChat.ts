import { useState, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { ChatMessage } from '../types/ai-design-chat';
import { DesignImageGenerationService } from '../services/DesignImageGenerationService';

const isRefinement = (text: string, currentPrompt: string): boolean => {
  if (!currentPrompt) return false;
  const lower = text.toLowerCase();
  const roomKeywords = ['bedroom', 'living', 'kitchen', 'bathroom', 'office', 'dining', 'lounge', 'salon', 'room'];
  return !roomKeywords.some(keyword => lower.includes(keyword));
};

export function useAIDesignChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [accumulatedPrompt, setAccumulatedPrompt] = useState<string>('');

  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const removeLoadingMessage = useCallback(() => {
    setMessages(prev => prev.filter(m => m.type !== 'loading'));
  }, []);

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
      label: 'Generating your custom 3D design render...',
      createdAt: Date.now()
    });

    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Determine prompt combination (cumulative description)
      let nextPrompt = trimmed;
      if (isRefinement(trimmed, accumulatedPrompt)) {
        nextPrompt = `${accumulatedPrompt}, ${trimmed}`;
      }

      const imageService = new DesignImageGenerationService();
      const mockProposal = {
        id: `img_${Math.random().toString()}`,
        roomType: 'Room',
        title: 'Custom AI Design',
        description: nextPrompt,
        layout: {
          id: '',
          version: 1,
          furniture: [],
          metadata: {
            generatedAt: Date.now(),
            algorithm: 'genetic' as const,
            iterationsCount: 0
          }
        },
        performanceScore: {
          spaceEfficiency: 0,
          comfort: 0,
          symmetry: 0,
          accessibility: 0,
          aesthetics: 0,
          functionalFlow: 0,
          lighting: 0,
          ergonomics: 0,
          overall: 0
        },
        visualization: {},
        colorPalette: [],
        recommendedFurniture: [],
        estimatedCost: { low: 0, mid: 0, high: 0 },
        pros: [],
        cons: [],
        rank: 1
      };

      const preferences = {
        roomType: 'room',
        style: 'modern',
        colors: [],
        budget: 'medium',
        customDesign: nextPrompt
      };

      const result = await imageService.generateDesignImage(mockProposal, preferences);

      removeLoadingMessage();

      if (result && result.imageUrl) {
        setAccumulatedPrompt(nextPrompt);
        appendMessage({
          id: Math.random().toString(),
          role: 'assistant',
          type: 'image',
          imageUrl: result.imageUrl,
          prompt: nextPrompt,
          createdAt: Date.now()
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        throw new Error('Hugging Face FLUX service did not return an image URL.');
      }

    } catch (error: any) {
      console.warn('[Chat] Image generation error:', error);
      removeLoadingMessage();
      appendMessage({
        id: Math.random().toString(),
        role: 'assistant',
        type: 'error',
        message: error.message || 'Failed to generate design image. Please verify server connection.',
        createdAt: Date.now()
      });
    } finally {
      setIsPending(false);
    }
  }, [isPending, accumulatedPrompt, appendMessage, removeLoadingMessage]);

  const resetChat = useCallback(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        type: 'text',
        text: '👋 Hi! I am your AI Design Assistant. Tell me what kind of room you want to design (e.g., "Cozy minimalist bedroom with warm lighting"). I will generate a photorealistic 3D render, and you can type edits to modify it!',
        createdAt: Date.now()
      }
    ]);
    setAccumulatedPrompt('');
  }, []);

  return {
    messages,
    isPending,
    sendMessage,
    resetChat
  };
}
