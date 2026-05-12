/**
 * useThemeImageGeneration Hook
 * Manages AI image generation for themes
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { designImageGenerationService } from '@/services/DesignImageGenerationService';
import type { RoomType, DesignMood, DesignStyle, DesignTheme } from '@/types/theme-recommendation';
import type { DesignProposal } from '@/types/ai-design';
import { validateThemeData } from '@/types/theme-recommendation';
import type { GeneratedImageData } from '@/types/theme-recommend-ui';
import type { BudgetValue } from '@/config/themeRecommend.config';
import { ERROR_MESSAGES } from '@/config/themeRecommend.config';

interface UseThemeImageGenerationProps {
  selectedRoom: RoomType | null;
  selectedStyle: DesignStyle | null;
  selectedBudget: BudgetValue | null;
}

interface UseThemeImageGenerationReturn {
  generatedImages: Map<string, GeneratedImageData>;
  isGeneratingImage: string | null;
  imageGenerationError: string | null;
  isLoadingImage: boolean;
  handleGenerateImage: (theme: DesignTheme, forceRegenerate?: boolean) => Promise<void>;
  clearGeneratedImage: (themeId: string) => void;
  // Custom design input
  customDesignText: string;
  setCustomDesignText: (text: string) => void;
  customDesignImage: string | null;
  customDesignAttribution: { photographer?: string; photographerUrl?: string; source?: string } | null;
  isGeneratingCustomImage: boolean;
  handleGenerateCustomDesign: () => Promise<void>;
  clearCustomDesignImage: () => void;
}

export function useThemeImageGeneration({
  selectedRoom,
  selectedStyle,
  selectedBudget,
}: UseThemeImageGenerationProps): UseThemeImageGenerationReturn {
  const isMountedRef = useRef(true);

  const [generatedImages, setGeneratedImages] = useState<Map<string, GeneratedImageData>>(new Map());
  const [isGeneratingImage, setIsGeneratingImage] = useState<string | null>(null);
  const [imageGenerationError, setImageGenerationError] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  
  // Custom design input state
  const [customDesignText, setCustomDesignText] = useState<string>('');
  const [customDesignImage, setCustomDesignImage] = useState<string | null>(null);
  const [customDesignAttribution, setCustomDesignAttribution] = useState<{ photographer?: string; photographerUrl?: string; source?: string } | null>(null);
  const [isGeneratingCustomImage, setIsGeneratingCustomImage] = useState(false);

  // Cleanup
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Clear generated image
  const clearGeneratedImage = useCallback((themeId: string) => {
    setGeneratedImages(prev => {
      const newImages = new Map(prev);
      newImages.delete(themeId);
      return newImages;
    });
  }, []);

  // Generate image for theme
  const handleGenerateImage = useCallback(async (theme: DesignTheme, forceRegenerate = false) => {
    console.log('[ImageGen] handleGenerateImage called', {
      themeId: theme?.id,
      themeName: theme?.name,
      forceRegenerate,
    });

    if (!validateThemeData(theme)) {
      console.error('[ImageGen] Invalid theme data', theme);
      Alert.alert('Error', ERROR_MESSAGES.INVALID_THEME_DATA);
      return;
    }

    // Check if image already exists
    if (!forceRegenerate) {
      const existingImage = generatedImages.get(theme.id);
      if (existingImage && !isGeneratingImage) {
        Alert.alert(
          'Image Already Generated',
          'This theme already has a generated image. Would you like to generate a new one?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Generate New',
              onPress: () => {
                clearGeneratedImage(theme.id);
                void handleGenerateImage(theme, true);
              },
            },
          ]
        );
        return;
      }
    }

    if (!selectedRoom) {
      Alert.alert('Missing Information', 'Room type is required to generate images.');
      return;
    }

    if (!selectedStyle) {
      Alert.alert('Missing Information', 'Design style is required to generate images.');
      return;
    }

    console.log('[ImageGen] Starting image generation', {
      themeId: theme.id,
      selectedRoom,
      selectedStyle,
      selectedBudget,
    });

    setIsGeneratingImage(theme.id);
    setIsLoadingImage(true);
    setImageGenerationError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const proposal: DesignProposal = {
        id: theme.id,
        title: theme.name,
        description: theme.description || '',
        layout: {
          id: theme.id,
          version: 1,
          furniture: (theme.decorItems || []).map((item, idx) => ({
            id: `decor_${idx}`,
            type: 'decor',
            category: 'decor' as const,
            name: item,
            dimensions: { width: 1, height: 1, length: 1 },
            position: { x: 0, y: 0, z: 0, rotation: 0 },
            properties: {},
            zIndex: idx,
          })),
          metadata: {
            generatedAt: Date.now(),
            algorithm: 'hybrid' as const,
            iterationsCount: 1,
          },
        },
        visualization: {},
        colorPalette: theme.colorPalette || [],
        recommendedFurniture: [],
        estimatedCost: { low: 1000, mid: 3000, high: 5000 },
        pros: [],
        cons: [],
        rank: 1,
        performanceScore: {
          overall: theme.confidence ? theme.confidence * 100 : 75,
          lighting: theme.moodScore || 80,
          ergonomics: theme.styleScore || 80,
          spaceEfficiency: theme.roomScore || 80,
          comfort: 80,
          symmetry: 80,
          accessibility: 80,
          aesthetics: 80,
          functionalFlow: 80,
        },
      };

      console.log('[ImageGen] Calling service with proposal:', proposal.id);

      const result = await designImageGenerationService.generateDesignImage(proposal, {
        roomType: selectedRoom,
        style: selectedStyle,
        colors: theme.colorPalette || [],
        budget: selectedBudget || 'medium',
        mood: theme.name,
        materials: theme.materials || [],
        imageSize: '1024x1024',
        quality: 'hd',
      });

      console.log('[ImageGen] Service returned:', result);

      if (!isMountedRef.current) return;

      if (result.imageUrl) {
        setGeneratedImages(prev => {
          const newImages = new Map(prev);
          newImages.set(theme.id, {
            imageUrl: result.imageUrl!,
            prompt: result.prompt || '',
            generatedAt: Date.now(),
          });
          return newImages;
        });

        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        console.log('[ImageGen] Image generated successfully');
      } else {
        throw new Error('No image URL returned from service');
      }
    } catch (error) {
      console.error('[ImageGen] Error generating image:', error);

      if (!isMountedRef.current) return;

      const errorMessage = error instanceof Error ? error.message : 'Unknown error generating image';
      setImageGenerationError(errorMessage);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      Alert.alert(
        'Image Generation Failed',
        errorMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Retry',
            onPress: () => void handleGenerateImage(theme, true),
          },
        ]
      );
    } finally {
      if (isMountedRef.current) {
        setIsGeneratingImage(null);
        setIsLoadingImage(false);
      }
    }
  }, [generatedImages, isGeneratingImage, selectedRoom, selectedStyle, selectedBudget, clearGeneratedImage]);

  // Generate image from custom design text
  const handleGenerateCustomDesign = useCallback(async () => {
    if (!customDesignText || !customDesignText.trim()) {
      Alert.alert('Missing Input', 'Please enter your design description first.');
      return;
    }

    console.log('[ImageGen] Generating custom design image:', customDesignText);

    setIsGeneratingCustomImage(true);
    setImageGenerationError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const proposal: DesignProposal = {
        id: 'custom-design',
        title: 'Custom Design',
        description: customDesignText.trim(),
        layout: {
          id: 'custom-layout',
          version: 1,
          furniture: [],
          metadata: {
            generatedAt: Date.now(),
            algorithm: 'hybrid' as const,
            iterationsCount: 1,
          },
        },
        visualization: {},
        colorPalette: [],
        recommendedFurniture: [],
        estimatedCost: { low: 1000, mid: 3000, high: 5000 },
        pros: [],
        cons: [],
        rank: 1,
        performanceScore: {
          overall: 80,
          lighting: 80,
          ergonomics: 80,
          spaceEfficiency: 80,
          comfort: 80,
          symmetry: 80,
          accessibility: 80,
          aesthetics: 80,
          functionalFlow: 80,
        },
      };

      const result = await designImageGenerationService.generateDesignImage(proposal, {
        roomType: selectedRoom || 'living room',
        style: selectedStyle || 'modern',
        colors: [],
        budget: selectedBudget || 'medium',
        mood: undefined,
        materials: [],
        imageSize: '1024x1024',
        quality: 'hd',
        customDesign: customDesignText.trim(), // Pass custom design text
      });

      console.log('[ImageGen] Custom design image generated:', result);

      if (!isMountedRef.current) return;

      if (result.imageUrl) {
        setCustomDesignImage(result.imageUrl);
        if (result.attribution) {
          setCustomDesignAttribution(result.attribution);
        }
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        console.log('[ImageGen] Custom design image generated successfully');
      } else {
        throw new Error('No image URL returned from service');
      }
    } catch (error) {
      console.error('[ImageGen] Error generating custom design image:', error);

      if (!isMountedRef.current) return;

      const errorMessage = error instanceof Error ? error.message : 'Unknown error generating image';
      setImageGenerationError(errorMessage);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      Alert.alert(
        'Image Generation Failed',
        errorMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Retry',
            onPress: () => void handleGenerateCustomDesign(),
          },
        ]
      );
    } finally {
      if (isMountedRef.current) {
        setIsGeneratingCustomImage(false);
      }
    }
  }, [customDesignText, selectedRoom, selectedStyle, selectedBudget]);

  // Clear custom design image
  const clearCustomDesignImage = useCallback(() => {
    setCustomDesignImage(null);
    setCustomDesignAttribution(null);
  }, []);

  return {
    generatedImages,
    isGeneratingImage,
    imageGenerationError,
    isLoadingImage,
    handleGenerateImage,
    clearGeneratedImage,
    customDesignText,
    setCustomDesignText,
    customDesignImage,
    customDesignAttribution,
    isGeneratingCustomImage,
    handleGenerateCustomDesign,
    clearCustomDesignImage,
  };
}

