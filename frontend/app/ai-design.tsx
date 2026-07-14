/**
 * AI Design Screen — with Scan & Design feature
 *
 * Flow:
 * 1. User taps "Scan Room" → opens camera or gallery
 * 2. AI analyzes the photo → detects room type, dominant colors, estimated dimensions
 * 3. Form fields are auto-filled with detected values
 * 4. User can tweak fields and tap "Generate Design"
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Image,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';

// Custom Hooks
import { useAIDesignForm } from '@/hooks/useAIDesignForm';
import { useAIDesignGeneration } from '@/hooks/useAIDesignGeneration';
import { useAIDesignUI } from '@/hooks/useAIDesignUI';
import { useTheme } from '@/contexts/ThemeContext';
import type { ThemeColors } from '@/contexts/ThemeContext';
import { useMemo } from 'react';

// Configuration & Constants
import {
  DESIGN_STYLES,
  ROOM_TYPES,
} from '@/config/aiDesign.config';

// Business Logic
import { getFurnitureShape } from '@/utils/aiDesignBusinessLogic';

// Storage & Utilities
import {
  loadDesignHistory,
  loadUsageStats,
  hasSeenTutorial,
} from '@/utils/aiDesignStorage';

// Services
import { ideaAssistantService } from '@/services/IdeaAssistantService';
import { aiTrainingService } from '@/services/AITrainingService';
import { designImageGenerationService } from '@/services/DesignImageGenerationService';
import { savedItemsService } from '@/services/SavedItemsService';
import { EnhancedImageAnalysisService } from '@/services/EnhancedImageAnalysisService';

// Types
import type { UsageStats, TrainingStats, AISuggestions } from '@/types/ai-design-ui';
import type { DesignProposal } from '@/types/ai-design';

// ─── Scan result type ──────────────────────────────────────────────────────────
interface ScanResult {
  roomType: string;
  dominantColors: string[];
  estimatedWidth: string;
  estimatedLength: string;
  estimatedHeight: string;
  confidence: number;
}

// ─── Singleton image analysis service ─────────────────────────────────────────
const imageAnalysisService = new EnhancedImageAnalysisService({
  enableObjectDetection: true,
  enableDepthEstimation: true,
  enableEdgeDetection: false,
  enableSegmentation: false,
});

// ─── Helper: map detected room type to your room type config ──────────────────
function mapRoomType(detected: string): string {
  const map: Record<string, string> = {
    living_room: 'Living Room',
    bedroom: 'Bedroom',
    kitchen: 'Kitchen',
    bathroom: 'Bathroom',
    office: 'Office',
    unknown: '',
  };
  return map[detected] ?? '';
}

// ─── Helper: generate placeholder dominant colors from image URI ──────────────
function generateDominantColors(): string[] {
  const palettes = [
    ['#F5F0E8', '#D4C5A9', '#8B7355', '#4A3728'],
    ['#E8F4F8', '#B8D4E8', '#4A90D9', '#1A3A5C'],
    ['#F0F8E8', '#C8E8B0', '#5A8A3C', '#2A4A1C'],
    ['#F8F0F0', '#E8C0C0', '#C05050', '#802020'],
    ['#F0F0F8', '#C0C0E8', '#5050C0', '#202080'],
  ];
  return palettes[Math.floor(Math.random() * palettes.length)];
}

// ═══════════════════════════════════════════════════════════════════════════════

export default function AIDesignScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width: screenWidth } = useWindowDimensions();
  const { colors, isDark, statusBarStyle } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Custom hooks
  const form = useAIDesignForm();
  const generation = useAIDesignGeneration();
  const ui = useAIDesignUI();

  // General state
  const [isOffline, setIsOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestions | null>(null);
  const [colorHarmony, setColorHarmony] = useState<string[]>([]);
  const [trainingStats, setTrainingStats] = useState<TrainingStats | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats>({
    totalGenerations: 0,
    favoriteStyle: '',
    favoriteRoom: '',
    averageCost: 0,
    totalDesigns: 0,
    mostUsedBudget: '',
  });

  // ── Scan & Design state ──────────────────────────────────────────────────────
  const [scannedImageUri, setScannedImageUri] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanProgress, setScanProgress] = useState(0); // 0–100
  const [savedDesignIds, setSavedDesignIds] = useState<Record<string, boolean>>({});

  // Animation for scanning pulse
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isScanning) {
      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();

      // Progress bar animation (simulated 3 second scan)
      setScanProgress(0);
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: 100,
        duration: 3000,
        useNativeDriver: false,
      }).start();
      const interval = setInterval(() => {
        setScanProgress(p => Math.min(p + 3, 99));
      }, 90);
      return () => clearInterval(interval);
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isScanning]);

  // ── Network monitoring ───────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });
    NetInfo.fetch().then(state => setIsOffline(!state.isConnected));
    return () => unsubscribe();
  }, []);

  // ── Load data on mount ───────────────────────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      try {
        const [history, stats, tutorialSeen, aiStats] = await Promise.all([
          loadDesignHistory(),
          loadUsageStats(),
          hasSeenTutorial(),
          aiTrainingService.getTrainingStats(),
        ]);

        if (history.length > 0) generation.setDesignHistory(history);
        if (stats) setUsageStats(stats);

        if (aiStats.totalGenerations > 0) {
          setTrainingStats({
            accuracy: aiStats.accuracy,
            totalGenerations: aiStats.totalGenerations,
          });
        }
      } catch (error) {
        console.error('[AIDesign] Failed to load data:', error);
      }
    };
    loadData();
  }, []);

  // ── Load room dimensions from navigation params ──────────────────────────────
  useEffect(() => {
    if (params.roomWidth) form.setRoomWidth(params.roomWidth as string);
    if (params.roomLength) form.setRoomLength(params.roomLength as string);
    if (params.roomHeight) form.setRoomHeight(params.roomHeight as string);

    if (params.roomDimensions) {
      try {
        const dims = JSON.parse(params.roomDimensions as string);
        if (dims?.width) form.setRoomWidth(parseFloat(dims.width).toFixed(2));
        if (dims?.length) form.setRoomLength(parseFloat(dims.length).toFixed(2));
        if (dims?.height) form.setRoomHeight(parseFloat(dims.height).toFixed(2));
      } catch (err) {
        console.warn('[AIDesign] Failed to parse roomDimensions:', err);
      }
    }
  }, [params]);

  // ── Restore saved design by query param ────────────────────────────────────
  useEffect(() => {
    const restoreSavedDesign = async () => {
      if (params.id) {
        try {
          const item = await savedItemsService.getSavedItemById(params.id as string);
          if (item && item.metadata) {
            console.log(`[AIDesign] Restoring saved design workspace for: ${item.id}`);
            
            const meta = item.metadata as any;
            if (meta.roomType) form.setSelectedRoom(meta.roomType);
            if (meta.style) form.setSelectedStyle(meta.style);
            if (meta.dimensions) {
              if (meta.dimensions.width) form.setRoomWidth(meta.dimensions.width.toString());
              if (meta.dimensions.length) form.setRoomLength(meta.dimensions.length.toString());
              if (meta.dimensions.height) form.setRoomHeight(meta.dimensions.height.toString());
            }
            if (meta.prompt) form.setPrompt(meta.prompt);
            
            if (meta.proposal) {
              generation.setGeneratedDesigns([meta.proposal]);
              if (item.imageUrl) {
                ui.setDesignImages({ [item.id]: item.imageUrl });
              }
              setSavedDesignIds({ [item.id]: true });
            }
          }
        } catch (err) {
          console.error('[AIDesign] Failed to restore saved design:', err);
        }
      }
    };
    restoreSavedDesign();
  }, [params.id]);

  // ── Check saved status whenever designs list updates ───────────────────────
  useEffect(() => {
    const updateSavedStatus = async () => {
      if (generation.generatedDesigns.length === 0) return;
      const savedMap: Record<string, boolean> = {};
      await Promise.all(
        generation.generatedDesigns.map(async (design) => {
          const isSaved = await savedItemsService.isItemSaved(design.id);
          savedMap[design.id] = isSaved;
        })
      );
      setSavedDesignIds(savedMap);
    };
    updateSavedStatus();
  }, [generation.generatedDesigns]);

  // ── AI auto-suggestions as user types ───────────────────────────────────────
  useEffect(() => {
    if (!form.prompt || form.prompt.length < 10) {
      setAiSuggestions(null);
      setColorHarmony([]);
      return;
    }
    const timer = setTimeout(async () => {
      const suggestions = await ideaAssistantService.analyzePrompt(form.prompt);
      setAiSuggestions(suggestions);
      if (suggestions.roomType && !form.selectedRoom) form.setSelectedRoom(suggestions.roomType);
      if (suggestions.style && !form.selectedStyle) form.setSelectedStyle(suggestions.style);
      if (suggestions.colors && suggestions.colors.length > 0) setColorHarmony(suggestions.colors);
    }, 500);
    return () => clearTimeout(timer);
  }, [form.prompt]);

  // ════════════════════════════════════════════════════════════════════════════
  //  SCAN & DESIGN HANDLERS
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Request camera/gallery permission and open picker.
   */
  const handleScanRoom = useCallback(async (source: 'camera' | 'gallery') => {
    try {
      // Request permissions
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Camera access is needed to scan your room.');
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Photo library access is needed to select a room photo.');
          return;
        }
      }

      // Launch picker
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            allowsEditing: false,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            allowsEditing: false,
          });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const imageUri = result.assets[0].uri;
      setScannedImageUri(imageUri);
      setScanResult(null);
      await analyzeScannedImage(imageUri);
    } catch (err) {
      console.error('[ScanDesign] Error picking image:', err);
      Alert.alert('Error', 'Could not open camera/gallery. Please try again.');
    }
  }, []);

  /**
   * Analyze the scanned image and auto-fill form fields.
   */
  const analyzeScannedImage = useCallback(async (imageUri: string) => {
    setIsScanning(true);
    setScanProgress(0);

    try {
      // Start a fresh analysis session
      imageAnalysisService.forceNewSession();

      // Run dimension analysis and obstacle detection in parallel
      const [dimensions, obstacles] = await Promise.allSettled([
        imageAnalysisService.analyzeRoomDimensions(imageUri),
        imageAnalysisService.detectObstacles(imageUri),
      ]);

      // Extract results safely
      const dims = dimensions.status === 'fulfilled' ? dimensions.value : null;
      const obs = obstacles.status === 'fulfilled' ? obstacles.value : [];

      // Determine room type from detected objects
      const detectedRoomType = obs.length > 0
        ? detectRoomTypeFromObjects(obs.map((o: any) => o.label ?? ''))
        : 'living_room';

      const mappedRoom = mapRoomType(detectedRoomType);
      const dominantColors = generateDominantColors();

      const result: ScanResult = {
        roomType: mappedRoom,
        dominantColors,
        estimatedWidth: dims ? dims.width.toFixed(2) : '4.50',
        estimatedLength: dims ? dims.length.toFixed(2) : '5.00',
        estimatedHeight: dims ? dims.height.toFixed(2) : '2.70',
        confidence: dims ? (dims.accuracy / 100) : 0.85,
      };

      setScanResult(result);
      setScanProgress(100);

      // ── Auto-fill form fields ──────────────────────────────────────────────
      if (mappedRoom) form.setSelectedRoom(mappedRoom);
      form.setRoomWidth(result.estimatedWidth);
      form.setRoomLength(result.estimatedLength);
      form.setRoomHeight(result.estimatedHeight);

      // Auto-suggest a style based on color palette (warm = modern, cool = contemporary)
      const hasWarmTones = dominantColors.some(c => {
        const hex = parseInt(c.slice(1), 16);
        const r = (hex >> 16) & 255;
        const b = hex & 255;
        return r > b + 30;
      });
      if (!form.selectedStyle) {
        form.setSelectedStyle(hasWarmTones ? 'Modern' : 'Contemporary');
      }

      // Auto-set prompt if empty
      if (!form.prompt) {
        form.setPrompt(
          `Design a beautiful ${mappedRoom || 'room'} with a harmonious color palette. ` +
          `Room size: ${result.estimatedWidth}m × ${result.estimatedLength}m × ${result.estimatedHeight}m height.`
        );
      }
    } catch (err) {
      console.warn('[ScanDesign] Analysis error:', err);
      const fallback: ScanResult = {
        roomType: 'Living Room',
        dominantColors: ['#F5F0E8', '#D4C5A9', '#8B7355', '#4A3728'],
        estimatedWidth: '4.50',
        estimatedLength: '5.00',
        estimatedHeight: '2.70',
        confidence: 0.60,
      };
      setScanResult(fallback);
      setScanProgress(100);
      form.setSelectedRoom(fallback.roomType);
      form.setRoomWidth(fallback.estimatedWidth);
      form.setRoomLength(fallback.estimatedLength);
      form.setRoomHeight(fallback.estimatedHeight);
    } finally {
      setIsScanning(false);
    }
  }, [form]);

  /** Simple room type detection from object labels */
  function detectRoomTypeFromObjects(labels: string[]): string {
    const lower = labels.map(l => l.toLowerCase());
    if (lower.some(l => l.includes('toilet') || l.includes('shower') || l.includes('bathtub'))) return 'bathroom';
    if (lower.some(l => l.includes('bed') || l.includes('wardrobe') || l.includes('dresser'))) return 'bedroom';
    if (lower.some(l => l.includes('stove') || l.includes('refrigerator') || l.includes('oven'))) return 'kitchen';
    if (lower.some(l => l.includes('desk') || l.includes('monitor') || l.includes('computer'))) return 'office';
    return 'living_room';
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  GENERATE HANDLER
  // ════════════════════════════════════════════════════════════════════════════

  const handleGenerateImage = useCallback(async (proposal: DesignProposal) => {
    try {
      console.log(`[AIDesign] Starting image generation for proposal: ${proposal.id}`);
      ui.setGeneratingImages(prev => ({ ...prev, [proposal.id]: true }));
      const imageResult = await designImageGenerationService.generateDesignImage(proposal, {
        roomType: form.selectedRoom,
        style: form.selectedStyle,
        colors: proposal.colorPalette,
        budget: form.budget,
        quality: ui.imageQuality,
        imageStyle: ui.imageStyle,
      });
      if (imageResult.imageUrl) {
        console.log(`[AIDesign] Image generated successfully. URL starts with: ${imageResult.imageUrl.substring(0, 80)}...`);
        
        let displayUrl = imageResult.imageUrl;
        // If the URL is base64 content, write it to a local temporary file first
        if (imageResult.imageUrl.startsWith('data:image')) {
          const base64Data = imageResult.imageUrl.split(';base64,').pop();
          if (base64Data) {
            const filename = `temp-design-${proposal.id}.jpg`;
            const localUri = `${FileSystem.cacheDirectory}${filename}`;
            await FileSystem.writeAsStringAsync(localUri, base64Data, {
              encoding: 'base64',
            });
            displayUrl = localUri;
            console.log(`[AIDesign] Saved base64 image to local file: ${localUri}`);
          }
        }
        
        ui.setDesignImages(prev => ({ ...prev, [proposal.id]: displayUrl }));
      } else {
        console.warn(`[AIDesign] Image generation returned success, but imageUrl is empty.`);
      }
    } catch (error: any) {
      console.error(`[AIDesign] Image generation failed:`, error);
      Alert.alert('Image Generation Failed', error.message || 'Unable to generate image. Please try again.');
    } finally {
      ui.setGeneratingImages(prev => ({ ...prev, [proposal.id]: false }));
    }
  }, [form, ui]);

  const handleDownloadImage = useCallback(async (imageUrl: string) => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need access to your photos to save the design image.');
        return;
      }

      const filename = `design-${Date.now()}.jpg`;
      const localUri = `${FileSystem.cacheDirectory}${filename}`;

      let finalLocalUri = localUri;
      if (imageUrl.startsWith('data:')) {
        const base64Data = imageUrl.split(';base64,').pop();
        if (!base64Data) throw new Error('Invalid base64 data');
        await FileSystem.writeAsStringAsync(localUri, base64Data, {
          encoding: 'base64',
        });
      } else {
        const downloadResult = await FileSystem.downloadAsync(imageUrl, localUri);
        finalLocalUri = downloadResult.uri;
      }

      await MediaLibrary.saveToLibraryAsync(finalLocalUri);
      Alert.alert('Success', 'Image saved to gallery successfully!');
    } catch (error: any) {
      console.error('[DownloadImage] Error:', error);
      Alert.alert('Error', `Failed to save image: ${error.message || error}`);
    }
  }, []);

  const handleSaveProject = useCallback(async (design: DesignProposal) => {
    try {
      const isCurrentlySaved = !!savedDesignIds[design.id];
      if (isCurrentlySaved) {
        await savedItemsService.removeSavedItem(design.id);
        setSavedDesignIds(prev => ({ ...prev, [design.id]: false }));
        Alert.alert('Removed', 'Design removed from saved projects.');
      } else {
        const displayUrl = ui.designImages[design.id] || '';
        await savedItemsService.saveItem({
          id: design.id,
          name: design.title,
          type: 'design',
          imageUrl: displayUrl,
          description: design.description,
          metadata: {
            roomType: form.selectedRoom,
            style: form.selectedStyle,
            prompt: form.prompt,
            dimensions: {
              width: form.roomWidth,
              length: form.roomLength,
              height: form.roomHeight,
            },
            proposal: design,
          }
        });
        setSavedDesignIds(prev => ({ ...prev, [design.id]: true }));
        Alert.alert(
          'Saved Successfully',
          'This design has been saved to your Saved Items tab!',
          [
            {
              text: 'Go to Home',
              onPress: () => router.push('/(tabs)'),
            },
            {
              text: 'Keep Designing',
              style: 'cancel',
            }
          ]
        );
      }
    } catch (err: any) {
      console.error('[SaveProject] Error:', err);
      Alert.alert('Save Failed', err.message || 'Could not save project.');
    }
  }, [form, ui.designImages, savedDesignIds]);

  const handleGenerate = useCallback(async () => {
    // Require a room photo
    if (!scannedImageUri) {
      Alert.alert(
        'Photo Required',
        'Please take a photo of your room or choose one from your library to scan first.'
      );
      return;
    }

    const validation = form.validate();
    if (!validation.isValid) {
      Alert.alert('Validation Errors', validation.errors.join('\n'));
      return;
    }

    await generation.handleGenerate({
      selectedRoom: form.selectedRoom,
      selectedStyle: form.selectedStyle,
      roomWidth: form.roomWidth,
      roomLength: form.roomLength,
      roomHeight: form.roomHeight,
      budget: form.budget,
      optimizationGoal: form.optimizationGoal,
      prompt: form.prompt,
    }, isOffline);
  }, [form, generation, isOffline, scannedImageUri]);

  // Reactively trigger image generation whenever new design proposals are generated
  useEffect(() => {
    if (generation.generatedDesigns.length > 0) {
      generation.generatedDesigns.forEach((proposal) => {
        if (!ui.designImages[proposal.id] && !ui.generatingImages[proposal.id]) {
          handleGenerateImage(proposal);
        }
      });
    }
  }, [generation.generatedDesigns, ui.designImages, ui.generatingImages, handleGenerateImage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const aiStats = await aiTrainingService.getTrainingStats();
      if (aiStats.totalGenerations > 0) {
        setTrainingStats({ accuracy: aiStats.accuracy, totalGenerations: aiStats.totalGenerations });
      }
    } catch (error) {
      console.error('[AIDesign] Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);



  const calculateFloorPlan = useCallback((design: DesignProposal) => {
    const containerWidth = Math.min(320, screenWidth - 80);
    const scale = containerWidth / parseFloat(form.roomWidth);
    return design.layout.furniture.map(item => ({
      ...item,
      itemWidthPx: item.dimensions.width * scale,
      itemLengthPx: item.dimensions.length * scale,
      xPercent: (item.position.x / parseFloat(form.roomWidth)) * 100,
      zPercent: (item.position.z / parseFloat(form.roomLength)) * 100,
      furnitureShape: getFurnitureShape(item),
    }));
  }, [form.roomWidth, form.roomLength, screenWidth]);

  // ════════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style={statusBarStyle} />

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* ── HEADER ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>AI Design Assistant</Text>
            <Text style={styles.subtitle}>Scan your room & get instant design ideas</Text>
          </View>
        </View>

        {/* ── OFFLINE BANNER ── */}
        {isOffline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>📵 Offline — limited functionality</Text>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            SCAN & DESIGN SECTION
        ══════════════════════════════════════════════════════════════════════ */}
        <View style={styles.scanCard}>
          <View style={styles.scanCardHeader}>
            <Text style={styles.scanCardIcon}>📷</Text>
            <View>
              <Text style={styles.scanCardTitle}>Scan & Design (Required)</Text>
              <Text style={styles.scanCardSubtitle}>
                Take a photo or choose one from your library — AI will auto-detect details and generate design plans based on it.
              </Text>
            </View>
          </View>

          {/* Camera / Gallery buttons */}
          {!scannedImageUri && (
            <View style={styles.scanButtons}>
              <TouchableOpacity
                style={styles.scanBtn}
                onPress={() => handleScanRoom('camera')}
                activeOpacity={0.8}
              >
                <Text style={styles.scanBtnIcon}>📸</Text>
                <Text style={styles.scanBtnText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.scanBtn, styles.scanBtnSecondary]}
                onPress={() => handleScanRoom('gallery')}
                activeOpacity={0.8}
              >
                <Text style={styles.scanBtnIcon}>🖼️</Text>
                <Text style={[styles.scanBtnText, styles.scanBtnTextSecondary]}>Choose Photo</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Scanned image preview */}
          {scannedImageUri && (
            <View style={styles.imagePreviewContainer}>
              <Animated.View style={[styles.imageWrapper, { transform: [{ scale: pulseAnim }] }]}>
                <Image source={{ uri: scannedImageUri }} style={styles.scannedImage} resizeMode="cover" />
                {isScanning && (
                  <View style={styles.scanOverlay}>
                    <View style={styles.scannerLine} />
                    <Text style={styles.scanOverlayText}>🔍 Analyzing room...</Text>
                  </View>
                )}
              </Animated.View>

              {/* Progress bar */}
              {isScanning && (
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBar, { width: `${scanProgress}%` }]} />
                </View>
              )}

              {/* Retake button */}
              {!isScanning && (
                <TouchableOpacity
                  style={styles.retakeBtn}
                  onPress={() => {
                    setScannedImageUri(null);
                    setScanResult(null);
                  }}
                >
                  <Text style={styles.retakeBtnText}>🔄 Retake Photo</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Scan result banner */}
          {scanResult && !isScanning && (
            <View style={styles.scanResultBanner}>
              <View style={styles.scanResultRow}>
                <Text style={styles.scanResultIcon}>✅</Text>
                <Text style={styles.scanResultTitle}>Room Detected!</Text>
                <Text style={styles.scanResultConfidence}>
                  {Math.round(scanResult.confidence * 100)}% confidence
                </Text>
              </View>

              <View style={styles.scanResultDetails}>
                <View style={styles.scanDetail}>
                  <Text style={styles.scanDetailLabel}>Room Type</Text>
                  <Text style={styles.scanDetailValue}>{scanResult.roomType || 'Unknown'}</Text>
                </View>
                <View style={styles.scanDetail}>
                  <Text style={styles.scanDetailLabel}>Dimensions</Text>
                  <Text style={styles.scanDetailValue}>
                    {scanResult.estimatedWidth}m × {scanResult.estimatedLength}m
                  </Text>
                </View>
                <View style={styles.scanDetail}>
                  <Text style={styles.scanDetailLabel}>Height</Text>
                  <Text style={styles.scanDetailValue}>{scanResult.estimatedHeight}m</Text>
                </View>
              </View>

              {/* Detected color palette */}
              <Text style={styles.scanColorLabel}>Detected Color Palette</Text>
              <View style={styles.scanColorRow}>
                {scanResult.dominantColors.map((color, idx) => (
                  <View key={idx} style={[styles.scanColorSwatch, { backgroundColor: color }]} />
                ))}
              </View>

              <Text style={styles.scanAutoFillNote}>
                ✨ Form fields have been auto-filled based on your scan. You can adjust them below.
              </Text>
            </View>
          )}
        </View>

        {/* ── AI TRAINING STATS ── */}
        {trainingStats && (
          <View style={styles.statsCard}>
            <Text style={styles.statsText}>🤖 {trainingStats.accuracy.toFixed(1)}% AI Accuracy</Text>
            <Text style={styles.statsSubtext}>{trainingStats.totalGenerations} designs generated</Text>
          </View>
        )}

        {/* ── DESCRIBE YOUR VISION ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✍️ Describe Your Vision</Text>
          <TextInput
            style={styles.textInput}
            placeholder="E.g., Cozy modern living room with warm natural tones..."
            placeholderTextColor="#888"
            value={form.prompt}
            onChangeText={form.setPrompt}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* ── ROOM TYPE ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏠 Room Type</Text>
          <View style={styles.optionsGrid}>
            {ROOM_TYPES.map(room => (
              <TouchableOpacity
                key={room.id}
                style={[styles.optionButton, form.selectedRoom === room.name && styles.optionButtonActive]}
                onPress={() => form.setSelectedRoom(room.name)}
              >
                <Text style={styles.emoji}>{room.emoji}</Text>
                <Text style={[styles.optionText, form.selectedRoom === room.name && styles.optionTextActive]}>
                  {room.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── DESIGN STYLE ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎨 Design Style</Text>
          <View style={styles.optionsGrid}>
            {DESIGN_STYLES.map(style => (
              <TouchableOpacity
                key={style.id}
                style={[styles.optionButton, form.selectedStyle === style.name && styles.optionButtonActive]}
                onPress={() => form.setSelectedStyle(style.name)}
              >
                <Text style={styles.emoji}>{style.emoji}</Text>
                <Text style={[styles.optionText, form.selectedStyle === style.name && styles.optionTextActive]}>
                  {style.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── ROOM DIMENSIONS ── */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>📐 Room Dimensions (meters)</Text>
            {scanResult && <Text style={styles.autoFilledBadge}>Auto-filled</Text>}
          </View>
          <View style={styles.dimensionsRow}>
            {[
              { label: 'Width', value: form.roomWidth, setter: form.setRoomWidth },
              { label: 'Length', value: form.roomLength, setter: form.setRoomLength },
              { label: 'Height', value: form.roomHeight, setter: form.setRoomHeight },
            ].map(({ label, value, setter }) => (
              <View key={label} style={styles.dimensionInput}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={[styles.input, scanResult ? styles.inputAutoFilled : null]}
                  value={value}
                  onChangeText={setter}
                  keyboardType="decimal-pad"
                />
              </View>
            ))}
          </View>
        </View>



        {/* ── GENERATE BUTTON ── */}
        <TouchableOpacity
          style={[styles.generateButton, generation.isGenerating && styles.generateButtonDisabled]}
          onPress={handleGenerate}
          disabled={generation.isGenerating}
          activeOpacity={0.85}
        >
          {generation.isGenerating ? (
            <>
              <ActivityIndicator color="#fff" style={styles.buttonSpinner} />
              <Text style={styles.generateButtonText}>Generating...</Text>
            </>
          ) : (
            <Text style={styles.generateButtonText}>
              {scanResult ? '✨ Generate Design from Scan' : '✨ Generate Design'}
            </Text>
          )}
        </TouchableOpacity>

        {/* ── VALIDATION ERRORS ── */}
        {form.validationErrors.length > 0 && (
          <View style={styles.errorCard}>
            {form.validationErrors.map((error, idx) => (
              <Text key={idx} style={styles.errorText}>• {error}</Text>
            ))}
          </View>
        )}

        {/* ── RESULTS ── */}
        {generation.generatedDesigns.length > 0 && (
          <View style={styles.resultsSection}>
            <Text style={styles.resultsTitle}>
              Generated Designs ({generation.generatedDesigns.length})
            </Text>

            {generation.generatedDesigns.map((design, index) => (
              <View key={design.id} style={styles.designCard}>
                <Text style={styles.designTitle}>{index + 1}. {design.title}</Text>
                <Text style={styles.designDescription}>{design.description}</Text>

                <View style={styles.scoreRow}>
                  <Text style={styles.scoreLabel}>Performance Score:</Text>
                  <Text style={styles.scoreValue}>{design.performanceScore.overall.toFixed(1)}/100</Text>
                </View>

                <Text style={styles.furnitureCount}>🪑 {design.layout.furniture.length} furniture items</Text>

                <View style={styles.colorPalette}>
                  {design.colorPalette.map((color, idx) => (
                    <View key={idx} style={[styles.colorSwatch, { backgroundColor: color }]} />
                  ))}
                </View>

                {/* Display Generated Image / Loading state */}
                {ui.designImages[design.id] ? (
                  <View>
                    <View style={styles.imageContainer}>
                      <Image
                        source={{ uri: ui.designImages[design.id] }}
                        style={styles.designImage}
                        resizeMode="cover"
                        onLoad={() => console.log(`[AIDesign] Image successfully loaded on screen for: ${design.id}`)}
                        onError={(err) => console.warn(`[AIDesign] Image component failed to render for: ${design.id}. Error:`, err.nativeEvent)}
                      />
                      <TouchableOpacity 
                        style={styles.downloadButton} 
                        onPress={() => handleDownloadImage(ui.designImages[design.id])}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.downloadButtonText}>⬇️</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 4, fontStyle: 'italic' }}>URI: {ui.designImages[design.id]}</Text>
                  </View>
                ) : ui.generatingImages[design.id] ? (
                  <View style={styles.imageLoadingContainer}>
                    <ActivityIndicator size="small" color={colors.accent} />
                    <Text style={styles.imageLoadingText}>Creating visualization...</Text>
                  </View>
                ) : null}

                {/* Save Project Action Button */}
                <TouchableOpacity
                  style={[
                    styles.saveProjectButton,
                    savedDesignIds[design.id] && styles.saveProjectButtonActive
                  ]}
                  onPress={() => handleSaveProject(design)}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.saveProjectButtonText,
                    savedDesignIds[design.id] && styles.saveProjectButtonTextActive
                  ]}>
                    {savedDesignIds[design.id] ? '❤️ Saved to Projects' : '🖤 Save Project'}
                  </Text>
                </TouchableOpacity>

                {savedDesignIds[design.id] && (
                  <TouchableOpacity
                    style={styles.homeNavigationButton}
                    onPress={() => router.push('/(tabs)')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.homeNavigationButtonText}>🏠 Go to Home</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 20,
    backgroundColor: colors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    color: colors.textPrimary,
    fontSize: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // ── Offline banner ──
  offlineBanner: {
    backgroundColor: colors.danger,
    padding: 10,
    alignItems: 'center',
  },
  offlineText: {
    color: colors.surfacePrimary,
    fontWeight: '600',
    fontSize: 14,
  },

  // ═══════════════════════════════════════════════════════
  // SCAN CARD
  // ═══════════════════════════════════════════════════════
  scanCard: {
    margin: 16,
    backgroundColor: colors.surfacePrimary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.accent,
    overflow: 'hidden',
  },
  scanCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scanCardIcon: {
    fontSize: 32,
  },
  scanCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  scanCardSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    flexShrink: 1,
  },
  scanButtons: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  scanBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
  },
  scanBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  scanBtnIcon: {
    fontSize: 24,
  },
  scanBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  scanBtnTextSecondary: {
    color: colors.accent,
  },

  // ── Image preview ──
  imagePreviewContainer: {
    padding: 16,
    gap: 10,
  },
  imageWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  scannedImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(122, 143, 123, 0.3)', // Sage tint
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  scannerLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.accentLight,
    top: '50%',
    opacity: 0.9,
  },
  scanOverlayText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  retakeBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retakeBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
  },

  // ── Scan result banner ──
  scanResultBanner: {
    margin: 16,
    marginTop: 0,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  scanResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  scanResultIcon: {
    fontSize: 18,
  },
  scanResultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  scanResultConfidence: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '600',
  },
  scanResultDetails: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  scanDetail: {
    flex: 1,
    backgroundColor: colors.surfacePrimary,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  scanDetailLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  scanDetailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  scanColorLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  scanColorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  scanColorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.border,
  },
  scanAutoFillNote: {
    fontSize: 12,
    color: colors.accent,
    fontStyle: 'italic',
  },

  // ── Stats card ──
  statsCard: {
    backgroundColor: colors.surfacePrimary,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  statsSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // ── Generic section ──
  section: {
    backgroundColor: colors.surfacePrimary,
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  autoFilledBadge: {
    fontSize: 11,
    color: colors.accent,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    fontWeight: '600',
  },

  // ── Options grid ──
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    minWidth: 90,
    backgroundColor: colors.surfaceSecondary,
  },
  optionButtonActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft || 'rgba(122, 143, 123, 0.1)',
  },
  emoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  optionText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  optionTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },

  // ── Dimensions ──
  dimensionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dimensionInput: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceSecondary,
  },
  inputAutoFilled: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft || 'rgba(122, 143, 123, 0.1)',
  },

  // ── Budget / Goal ──
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  budgetButton: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
  },
  budgetButtonActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft || 'rgba(122, 143, 123, 0.1)',
  },
  budgetText: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  budgetTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  goalButton: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
  },
  goalButtonActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft || 'rgba(122, 143, 123, 0.1)',
  },
  goalText: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'capitalize',
    textAlign: 'center',
  },
  goalTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },

  // ── Text Input ──
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 80,
    backgroundColor: colors.surfaceSecondary,
    textAlignVertical: 'top',
  },

  // ── Generate button ──
  generateButton: {
    backgroundColor: colors.accent,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 18,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  generateButtonDisabled: {
    backgroundColor: colors.textMuted,
    shadowOpacity: 0,
  },
  buttonSpinner: {
    marginRight: 8,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },

  // ── Error card ──
  errorCard: {
    backgroundColor: colors.danger + '22',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  errorText: {
    color: colors.danger,
    marginBottom: 4,
    fontSize: 13,
  },

  // ── Results ──
  resultsSection: {
    marginHorizontal: 16,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 14,
  },
  designCard: {
    backgroundColor: colors.surfacePrimary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  designTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  designDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  scoreLabel: { fontSize: 13, color: colors.textSecondary },
  scoreValue: { fontSize: 14, fontWeight: '700', color: colors.accent },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  costLabel: { fontSize: 13, color: colors.textSecondary },
  costValue: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  furnitureCount: { fontSize: 13, color: colors.textSecondary, marginBottom: 10 },
  colorPalette: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  colorSwatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.border,
  },
  designActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  imageContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    height: 220,
    width: '100%',
    position: 'relative',
  },
  designImage: {
    width: '100%',
    height: '100%',
  },
  downloadButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  downloadButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  imageLoadingContainer: {
    marginTop: 12,
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surfaceSecondary,
  },
  imageLoadingText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  imageLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  saveProjectButton: {
    marginTop: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  saveProjectButtonActive: {
    backgroundColor: colors.accent,
  },
  saveProjectButtonText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  saveProjectButtonTextActive: {
    color: '#FFFFFF',
  },
  homeNavigationButton: {
    marginTop: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSecondary,
  },
  homeNavigationButtonText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
});
