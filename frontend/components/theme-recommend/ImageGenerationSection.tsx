import React from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import type { DesignTheme } from '@/types/theme-recommendation';

interface ImageGenerationSectionProps {
  theme: DesignTheme;
  generatedImages: Map<string, { imageUrl: string; prompt: string; generatedAt: number }>;
  isGeneratingImage: string | null;
  imageGenerationError: string | null;
  onGenerate: (theme: DesignTheme) => void;
  onRegenerate: (theme: DesignTheme) => void;
  onRetry: (theme: DesignTheme) => void;
  styles: any;
}

export const ImageGenerationSection: React.FC<ImageGenerationSectionProps> = ({
  theme,
  generatedImages,
  isGeneratingImage,
  imageGenerationError,
  onGenerate,
  onRegenerate,
  onRetry,
  styles: parentStyles,
}) => {
  const themeImage = generatedImages.get(theme.id);
  const isGenerating = isGeneratingImage === theme.id;

  return (
    <View style={parentStyles.imageGenerationSection}>
      <Text style={parentStyles.sectionLabel}>🖼️ Visual Preview</Text>
      {themeImage ? (
        <View style={parentStyles.generatedImageContainer}>
          <Image
            source={{ uri: themeImage.imageUrl }}
            style={parentStyles.generatedImage}
            resizeMode="cover"
            accessibilityLabel={`AI generated preview of ${theme.name} theme`}
          />
          <View style={parentStyles.imageOverlay}>
            <Text style={parentStyles.imageLabel}>AI Generated Preview</Text>
            <TouchableOpacity
              style={parentStyles.regenerateImageButton}
              onPress={() => onRegenerate(theme)}
              accessibilityRole="button"
              accessibilityLabel="Regenerate image"
            >
              <Text style={parentStyles.regenerateImageButtonText}>🔄 Regenerate</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={parentStyles.generateImageCard}>
          <Text style={parentStyles.generateImageText}>
            {isGenerating 
              ? '✨ Generating beautiful preview...' 
              : 'See how this theme looks in real life! Generate an AI-powered visual preview.'}
          </Text>
          {isGenerating ? (
            <View style={parentStyles.generatingIndicator}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={parentStyles.generatingText}>This may take 30-60 seconds</Text>
              <Text style={parentStyles.generatingText}>Please keep the app open...</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[parentStyles.generateImageButton, isGenerating && parentStyles.generateImageButtonDisabled]}
              onPress={() => onGenerate(theme)}
              disabled={isGenerating}
              accessibilityRole="button"
              accessibilityLabel="Generate AI preview image"
              accessibilityState={{ disabled: isGenerating }}
            >
              <Text style={parentStyles.generateImageButtonText}>🎨 Generate Preview</Text>
            </TouchableOpacity>
          )}
          {imageGenerationError && isGeneratingImage === theme.id && (
            <View style={parentStyles.imageErrorContainer}>
              <Text style={parentStyles.imageErrorText}>⚠️ {imageGenerationError}</Text>
              <TouchableOpacity
                style={parentStyles.retryImageButton}
                onPress={() => onRetry(theme)}
                accessibilityRole="button"
                accessibilityLabel="Retry image generation"
              >
                <Text style={parentStyles.retryImageButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
};


