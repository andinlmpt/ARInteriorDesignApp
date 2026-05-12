/**
 * Stable Diffusion AI Interior Design Screen
 * Generate and browse multiple interior design variations using Stable Diffusion
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ImagePickerAsset, launchImageLibraryAsync, MediaTypeOptions } from 'expo-image-picker';
import { stableDiffusionDesignService, type StableDiffusionRequest } from '@/services/StableDiffusionDesignService';
import { DesignGallery, type DesignImage } from '@/components/DesignGallery';
import { StyleSelector, type Style } from '@/components/StyleSelector';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { AppText } from '@/components/ui/Text';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { colors, spacing, radii, shadows } from '@/components/ui/theme';
// Import JSON config
// eslint-disable-next-line @typescript-eslint/no-var-requires
const designStylesConfig = require('@/config/interior-design-styles.json');

export default function StableDiffusionDesignScreen() {
  const router = useRouter();
  const [selectedStyle, setSelectedStyle] = useState<Style | null>(null);
  const [selectedRoomType, setSelectedRoomType] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [uploadedImage, setUploadedImage] = useState<ImagePickerAsset | null>(null);
  const [generatedImages, setGeneratedImages] = useState<DesignImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [numImages, setNumImages] = useState(4);
  const [sdModel, setSdModel] = useState<string>('interior-design');

  // Set default style on mount and configure API key
  useEffect(() => {
    if (!selectedStyle && designStylesConfig.styles.length > 0) {
      setSelectedStyle(designStylesConfig.styles[0] as Style);
    }
    if (!selectedRoomType && designStylesConfig.roomTypes.length > 0) {
      setSelectedRoomType(designStylesConfig.roomTypes[0].id);
    }
    
  }, []);

  // Handle style selection
  const handleStyleSelect = useCallback((style: Style) => {
    setSelectedStyle(style);
    // Clear custom prompt when style changes
    if (customPrompt) {
      setCustomPrompt('');
    }
  }, [customPrompt]);

  // Handle image upload
  const handleImageUpload = useCallback(async () => {
    try {
      const result = await launchImageLibraryAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets[0]) {
        setUploadedImage(result.assets[0]);
      }
    } catch (error) {
      console.error('[StableDiffusionDesign] Image upload error:', error);
      Alert.alert('Error', 'Failed to upload image');
    }
  }, []);

  // Handle design generation
  const handleGenerate = useCallback(async () => {
    if (!selectedStyle) {
      Alert.alert('Select Style', 'Please select a design style first');
      return;
    }

    if (!selectedRoomType) {
      Alert.alert('Select Room', 'Please select a room type first');
      return;
    }

    setIsGenerating(true);
    setGeneratedImages([]);

    try {
      // Prepare request
      const request: StableDiffusionRequest = {
        prompt: customPrompt || undefined,
        style: selectedStyle.id,
        roomType: selectedRoomType,
        numImages,
        model: sdModel,
      };

      // Add image if uploaded
      if (uploadedImage?.uri) {
        request.imageUrl = uploadedImage.uri;
      }

      // Generate designs using Stable Diffusion
      const result = await stableDiffusionDesignService.generateDesign(request);

      // Convert to DesignImage format
      const images: DesignImage[] = result.imageUrls.map((url, index) => ({
        id: `design-${Date.now()}-${index}`,
        url,
        prompt: result.prompt,
        style: result.style,
        roomType: result.roomType,
        generatedAt: result.generatedAt,
      }));

      // Log which model was used
      console.log(`[StableDiffusionDesign] Generated using model: ${result.model}`);

      setGeneratedImages(images);

      Alert.alert(
        'Success!',
        `Generated ${images.length} design variations in ${(result.processingTime / 1000).toFixed(1)}s`
      );
    } catch (error) {
      console.error('[StableDiffusionDesign] Generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate designs';
      Alert.alert('Generation Failed', errorMessage);
    } finally {
      setIsGenerating(false);
    }
  }, [selectedStyle, selectedRoomType, customPrompt, uploadedImage, numImages]);

  // Handle image selection from gallery
  const handleImagePress = useCallback((image: DesignImage) => {
    Alert.alert(
      'Design Selected',
      `Would you like to save this ${image.style} ${image.roomType} design?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: () => {
            // Navigate to save/view screen
            router.push({
              pathname: '/layout-3d',
              params: {
                designData: JSON.stringify({
                  title: `${image.style} ${image.roomType}`,
                  imageUrl: image.url,
                }),
              },
            });
          },
        },
      ]
    );
  }, [router]);

  const roomType = designStylesConfig.roomTypes.find((r) => r.id === selectedRoomType);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="dark" />
      <Screen contentContainerStyle={styles.screenContent}>
        <Header
          title="AI Interior Design"
          subtitle="Generate realistic room designs with AI"
        />

        {/* Style Selection */}
        <Card tone="elevated" style={styles.section}>
          <AppText variant="h3" color="textPrimary" style={styles.sectionTitle}>
            Select Style
          </AppText>
          <StyleSelector
            selectedStyleId={selectedStyle?.id || null}
            onStyleSelect={handleStyleSelect}
            showSearch={true}
          />
        </Card>

        {/* Room Type Selection */}
        <Card tone="elevated" style={styles.section}>
          <AppText variant="h3" color="textPrimary" style={styles.sectionTitle}>
            Room Type
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.roomTypeContainer}>
              {designStylesConfig.roomTypes.map((rt) => (
                <Button
                  key={rt.id}
                  label={`${rt.emoji} ${rt.name}`}
                  tone={selectedRoomType === rt.id ? 'primary' : 'secondary'}
                  onPress={() => setSelectedRoomType(rt.id)}
                  style={styles.roomTypeButton}
                />
              ))}
            </View>
          </ScrollView>
        </Card>

        {/* Optional: Custom Prompt */}
        <Card tone="elevated" style={styles.section}>
          <AppText variant="h3" color="textPrimary" style={styles.sectionTitle}>
            Custom Prompt (Optional)
          </AppText>
          <Input
            placeholder="Describe your ideal room design..."
            value={customPrompt}
            onChangeText={setCustomPrompt}
            multiline
            numberOfLines={3}
            style={styles.promptInput}
          />
          <AppText variant="caption" color="textMuted" style={styles.hint}>
            Leave empty to use the default style prompt
          </AppText>
        </Card>

        {/* Optional: Image Upload */}
        <Card tone="elevated" style={styles.section}>
          <AppText variant="h3" color="textPrimary" style={styles.sectionTitle}>
            Upload Room Photo (Optional)
          </AppText>
          <Button
            label={uploadedImage ? 'Change Photo' : 'Upload Photo'}
            tone="secondary"
            onPress={handleImageUpload}
            style={styles.uploadButton}
          />
          {uploadedImage && (
            <View style={styles.uploadedImageContainer}>
              <AppText variant="caption" color="textSecondary">
                Photo uploaded: {uploadedImage.fileName || 'image.jpg'}
              </AppText>
            </View>
          )}
        </Card>

        {/* Model Selection */}
        <Card tone="elevated" style={styles.section}>
          <AppText variant="h3" color="textPrimary" style={styles.sectionTitle}>
            AI Model
          </AppText>
          <View style={styles.modelSelector}>
            <AppText variant="caption" color="textSecondary" style={styles.modelLabel}>
              Select model:
            </AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.modelButtons}>
                <Button
                  label="Interior Design"
                  tone={sdModel === 'interior-design' ? 'primary' : 'secondary'}
                  onPress={() => setSdModel('interior-design')}
                  style={styles.modelButton}
                />
                <Button
                  label="Canopus (SDXL)"
                  tone={sdModel === 'canopus' ? 'primary' : 'secondary'}
                  onPress={() => setSdModel('canopus')}
                  style={styles.modelButton}
                />
                <Button
                  label="Interior Flux"
                  tone={sdModel === 'interior-flux' ? 'primary' : 'secondary'}
                  onPress={() => setSdModel('interior-flux')}
                  style={styles.modelButton}
                />
                <Button
                  label="SD 2.1"
                  tone={sdModel === 'stable-diffusion-2.1' ? 'primary' : 'secondary'}
                  onPress={() => setSdModel('stable-diffusion-2.1')}
                  style={styles.modelButton}
                />
              </View>
            </ScrollView>
          </View>
        </Card>

        {/* Generate Button */}
        <Button
          label={isGenerating ? 'Generating...' : 'Generate Designs'}
          tone="primary"
          onPress={handleGenerate}
          loading={isGenerating}
          disabled={isGenerating || !selectedStyle || !selectedRoomType}
          style={styles.generateButton}
        />

        {/* Generated Designs Gallery */}
        {generatedImages.length > 0 && (
          <Card tone="elevated" style={styles.section}>
            <AppText variant="h3" color="textPrimary" style={styles.sectionTitle}>
              Generated Designs ({generatedImages.length})
            </AppText>
            <DesignGallery
              images={generatedImages}
              onImagePress={handleImagePress}
              loading={isGenerating}
            />
          </Card>
        )}

        {/* Info */}
        <Card tone="default" style={styles.infoCard}>
          <AppText variant="caption" color="textMuted" style={styles.infoText}>
            💡 <AppText variant="caption" color="accent" weight="600">Stable Diffusion</AppText> is completely free and runs on your backend server using open-source models.
            {'\n\n'}
            See STABLE_DIFFUSION_SETUP.md for installation instructions.
          </AppText>
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
  },
  screenContent: {
    paddingBottom: spacing.xxl * 2,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  roomTypeContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  roomTypeButton: {
    marginRight: spacing.sm,
  },
  promptInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  hint: {
    marginTop: spacing.xs,
  },
  uploadButton: {
    marginTop: spacing.sm,
  },
  uploadedImageContainer: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.sm,
  },
  generateButton: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  infoCard: {
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  infoText: {
    textAlign: 'center',
    lineHeight: 20,
  },
  modelSelector: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  modelLabel: {
    marginBottom: spacing.xs,
  },
  modelButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modelButton: {
    marginRight: spacing.sm,
  },
});
