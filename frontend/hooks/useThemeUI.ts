/**
 * useThemeUI Hook
 * Manages UI state for theme recommendation screen
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Share, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import NetInfo from '@react-native-community/netinfo';
import type { RoomType, DesignMood, DesignStyle, ThemeRecommendationOutput } from '@/types/theme-recommendation';
import type { HistoryState, ColorState, ResultsData } from '@/types/theme-recommend-ui';
import type { StepType } from '@/config/themeRecommend.config';
import {
  CONFIG,
  ROOM_EMOJIS,
  MOOD_EMOJIS,
  STYLE_EMOJIS,
} from '@/config/themeRecommend.config';
import {
  getNumberValue,
  getArrayValue,
  getStringValue,
  getConfidencePercentage,
  getColorName,
} from '@/utils/themeRecommendHelpers';
import { validateThemeData } from '@/types/theme-recommendation';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface UseThemeUIProps {
  step: StepType;
  selectedRoom: RoomType | null;
  selectedMood: DesignMood | null;
  selectedStyle: DesignStyle | null;
  recommendationOutput: ThemeRecommendationOutput | null;
}

interface UseThemeUIReturn {
  // Network
  isOffline: boolean;
  // Tutorial
  showTutorial: boolean;
  tutorialStep: number;
  showInteractiveHelp: boolean;
  setShowTutorial: (show: boolean) => void;
  setTutorialStep: (step: number) => void;
  setShowInteractiveHelp: (show: boolean) => void;
  getTutorialSteps: () => Array<{ emoji: string; title: string; description: string }>;
  // Stats
  showThemeStats: boolean;
  setShowThemeStats: (show: boolean) => void;
  // Comparison
  comparisonMode: boolean;
  selectedThemesForComparison: string[];
  setComparisonMode: (mode: boolean) => void;
  setSelectedThemesForComparison: (themes: string[]) => void;
  // History
  historyFilter: HistoryState['historyFilter'];
  historySortBy: HistoryState['historySortBy'];
  searchQuery: string;
  historySearchQuery: string;
  showHistoryFilters: boolean;
  setHistoryFilter: (filter: HistoryState['historyFilter']) => void;
  setHistorySortBy: (sort: HistoryState['historySortBy']) => void;
  setSearchQuery: (query: string) => void;
  setShowHistoryFilters: (show: boolean) => void;
  filterAndSortHistory: (themes: ThemeRecommendationOutput[], likedThemes: Set<string>) => ThemeRecommendationOutput[];
  // Colors
  colorState: ColorState;
  setSelectedColorModal: (modal: ColorState['selectedColorModal']) => void;
  setCopiedColorFeedback: (feedback: string | null) => void;
  toggleFavoriteColor: (color: string) => void;
  setSelectedColorForImage: (color: string | null) => void;
  showColorPaletteActions: boolean;
  setShowColorPaletteActions: (show: boolean) => void;
  copyColorToClipboard: (color: string) => Promise<void>;
  // Results
  resultsData: ResultsData | null;
  // Animations
  scoreBarAnimations: React.MutableRefObject<{
    roomScore: Animated.Value;
    moodScore: Animated.Value;
    styleScore: Animated.Value;
  }>;
  // Refreshing
  refreshing: boolean;
  setRefreshing: (refreshing: boolean) => void;
}

export function useThemeUI({
  step,
  selectedRoom,
  selectedMood,
  selectedStyle,
  recommendationOutput,
}: UseThemeUIProps): UseThemeUIReturn {
  const isMountedRef = useRef(true);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const colorFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Network
  const [isOffline, setIsOffline] = useState(false);

  // Tutorial
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [showInteractiveHelp, setShowInteractiveHelp] = useState(false);

  // Stats
  const [showThemeStats, setShowThemeStats] = useState(true);

  // Comparison
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedThemesForComparison, setSelectedThemesForComparison] = useState<string[]>([]);

  // History
  const [historyFilter, setHistoryFilter] = useState<HistoryState['historyFilter']>('all');
  const [historySortBy, setHistorySortBy] = useState<HistoryState['historySortBy']>('date');
  const [searchQuery, setSearchQuery] = useState('');
  const [showHistoryFilters, setShowHistoryFilters] = useState(false);

  // Debounced search
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  useEffect(() => {
    setHistorySearchQuery(debouncedSearchQuery);
  }, [debouncedSearchQuery]);

  // Colors
  const [colorState, setColorState] = useState<ColorState>({
    selectedColorModal: null,
    copiedColorFeedback: null,
    favoriteColors: new Set(),
    selectedColorForImage: null,
  });
  const [showColorPaletteActions, setShowColorPaletteActions] = useState(false);

  // Refreshing
  const [refreshing, setRefreshing] = useState(false);

  // Animations
  const scoreBarAnimations = useRef({
    roomScore: new Animated.Value(0),
    moodScore: new Animated.Value(0),
    styleScore: new Animated.Value(0),
  });

  // Cleanup
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (animationRef.current) {
        animationRef.current.stop();
      }
      if (colorFeedbackTimeoutRef.current) {
        clearTimeout(colorFeedbackTimeoutRef.current);
      }
    };
  }, []);

  // Monitor network status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (isMountedRef.current) {
        setIsOffline(!state.isConnected);
      }
    });

    NetInfo.fetch().then(state => {
      if (isMountedRef.current) {
        setIsOffline(!state.isConnected);
      }
    }).catch(() => {});

    return () => unsubscribe();
  }, []);

  // Tutorial steps
  const getTutorialSteps = useCallback(() => {
    if (step === 'room') {
      return [
        { emoji: '🏠', title: 'Choose Your Room', description: 'Select the room type you\'re designing.' },
        { emoji: '💡', title: 'Why Room Matters', description: 'Different rooms need different themes.' },
      ];
    } else if (step === 'mood') {
      return [
        { emoji: '😊', title: 'Select Your Mood', description: `You've chosen ${selectedRoom}. Now select the desired mood.` },
        { emoji: '🎯', title: 'Mood Impact', description: 'Your mood choice affects color palettes and materials.' },
      ];
    } else if (step === 'style') {
      return [
        { emoji: '🎨', title: 'Pick Your Style', description: `Room: ${selectedRoom} • Mood: ${selectedMood}. Now select your style.` },
        { emoji: '✨', title: 'Style Selection', description: 'Your style determines furniture and decor recommendations.' },
      ];
    } else {
      return [
        { emoji: '✨', title: 'Your Results', description: `Based on your choices: ${selectedRoom}, ${selectedMood}, ${selectedStyle}.` },
        { emoji: '📊', title: 'Understanding Scores', description: 'Match confidence shows overall fit.' },
        { emoji: '🎯', title: 'Alternative Themes', description: 'Explore other themes that match your preferences.' },
      ];
    }
  }, [step, selectedRoom, selectedMood, selectedStyle]);

  // Filter and sort history
  const filterAndSortHistory = useCallback((
    themes: ThemeRecommendationOutput[],
    likedThemes: Set<string>
  ) => {
    let filtered = [...themes];

    if (historySearchQuery.trim()) {
      const query = historySearchQuery.toLowerCase();
      filtered = filtered.filter(theme =>
        theme?.topTheme?.name?.toLowerCase().includes(query) ||
        theme?.topTheme?.description?.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => {
      if (historySortBy === 'date') {
        const aDate = a.metadata?.recommendationDate || 0;
        const bDate = b.metadata?.recommendationDate || 0;
        return bDate - aDate;
      } else if (historySortBy === 'confidence') {
        const aConf = typeof a.topTheme.confidence === 'number' ? a.topTheme.confidence : 0;
        const bConf = typeof b.topTheme.confidence === 'number' ? b.topTheme.confidence : 0;
        return bConf - aConf;
      } else if (historySortBy === 'likes') {
        const aLikes = typeof a.topTheme.likes === 'number' ? a.topTheme.likes : 0;
        const bLikes = typeof b.topTheme.likes === 'number' ? b.topTheme.likes : 0;
        return bLikes - aLikes;
      }
      return 0;
    });
  }, [historySearchQuery, historySortBy]);

  // Color actions
  const setSelectedColorModal = useCallback((modal: ColorState['selectedColorModal']) => {
    setColorState(prev => ({ ...prev, selectedColorModal: modal }));
  }, []);

  const setCopiedColorFeedback = useCallback((feedback: string | null) => {
    setColorState(prev => ({ ...prev, copiedColorFeedback: feedback }));
  }, []);

  const toggleFavoriteColor = useCallback((color: string) => {
    setColorState(prev => {
      const newFavorites = new Set(prev.favoriteColors);
      if (newFavorites.has(color)) {
        newFavorites.delete(color);
      } else {
        newFavorites.add(color);
      }
      return { ...prev, favoriteColors: newFavorites };
    });
  }, []);

  const setSelectedColorForImage = useCallback((color: string | null) => {
    setColorState(prev => ({ ...prev, selectedColorForImage: color }));
  }, []);

  const copyColorToClipboard = useCallback(async (color: string) => {
    try {
      await Share.share({ message: color, title: 'Color Code' });
      setCopiedColorFeedback(color);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (colorFeedbackTimeoutRef.current) {
        clearTimeout(colorFeedbackTimeoutRef.current);
      }
      colorFeedbackTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setCopiedColorFeedback(null);
        }
      }, 2000);
    } catch (error) {
      console.error('[ThemeRecommend] Failed to copy color:', error);
    }
  }, [setCopiedColorFeedback]);

  // Compute results data
  const resultsData = useMemo((): ResultsData | null => {
    if (!recommendationOutput?.topTheme) return null;

    const topTheme = recommendationOutput.topTheme;
    if (!validateThemeData(topTheme)) {
      console.error('Invalid theme data');
      return null;
    }

    const alternativeThemes = recommendationOutput.alternativeThemes ?? [];
    const metadata = {
      sessionId: recommendationOutput.metadata?.sessionId ?? null,
      totalThemesAnalyzed: recommendationOutput.metadata?.totalThemesAnalyzed ?? alternativeThemes.length + 1,
      processingTime: recommendationOutput.metadata?.processingTime ?? 0,
      mlModel: recommendationOutput.metadata?.mlModel ?? 'N/A',
      confidenceLevel: recommendationOutput.metadata?.confidenceLevel ?? 'Unknown',
      recommendationDate: recommendationOutput.metadata?.recommendationDate,
    };
    const insights = recommendationOutput.insights ?? {
      reasonForRecommendation: 'No explanation available yet.',
      keyMatchingFactors: [],
    };

    return {
      topTheme,
      alternativeThemes,
      metadata,
      insights,
      sessionLabel: metadata.sessionId ?? '—',
      confidenceLevel: metadata.confidenceLevel ?? 'Unknown',
      totalAnalyzed: getNumberValue(metadata?.totalThemesAnalyzed, alternativeThemes.length + 1),
      processingTimeSeconds:
        getNumberValue(metadata?.processingTime, 0) > 0
          ? (getNumberValue(metadata?.processingTime, 0) / 1000).toFixed(1)
          : '0.0',
      modelName: getStringValue(metadata?.mlModel, 'N/A'),
      colorPalette: getArrayValue(topTheme?.colorPalette),
      materials: getArrayValue(topTheme?.materials),
      decorItems: getArrayValue(topTheme?.decorItems),
      moodScore: getNumberValue(topTheme?.moodScore, 0),
      styleScore: getNumberValue(topTheme?.styleScore, 0),
      roomScore: getNumberValue(topTheme?.roomScore, 0),
      confidenceValue: getConfidencePercentage(topTheme?.confidence),
    };
  }, [recommendationOutput]);

  // Animate score bars
  useEffect(() => {
    if (step === 'results' && resultsData) {
      const { moodScore, styleScore, roomScore } = resultsData;

      if (animationRef.current) {
        animationRef.current.stop();
      }

      scoreBarAnimations.current.roomScore.setValue(0);
      scoreBarAnimations.current.moodScore.setValue(0);
      scoreBarAnimations.current.styleScore.setValue(0);

      const animation = Animated.parallel([
        Animated.timing(scoreBarAnimations.current.roomScore, {
          toValue: roomScore,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(scoreBarAnimations.current.moodScore, {
          toValue: moodScore,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(scoreBarAnimations.current.styleScore, {
          toValue: styleScore,
          duration: 1000,
          useNativeDriver: false,
        }),
      ]);

      animationRef.current = animation;
      animation.start(() => {
        animationRef.current = null;
      });
    }
  }, [step, resultsData]);

  return {
    isOffline,
    showTutorial,
    tutorialStep,
    showInteractiveHelp,
    setShowTutorial,
    setTutorialStep,
    setShowInteractiveHelp,
    getTutorialSteps,
    showThemeStats,
    setShowThemeStats,
    comparisonMode,
    selectedThemesForComparison,
    setComparisonMode,
    setSelectedThemesForComparison,
    historyFilter,
    historySortBy,
    searchQuery,
    historySearchQuery,
    showHistoryFilters,
    setHistoryFilter,
    setHistorySortBy,
    setSearchQuery,
    setShowHistoryFilters,
    filterAndSortHistory,
    colorState,
    setSelectedColorModal,
    setCopiedColorFeedback,
    toggleFavoriteColor,
    setSelectedColorForImage,
    showColorPaletteActions,
    setShowColorPaletteActions,
    copyColorToClipboard,
    resultsData,
    scoreBarAnimations,
    refreshing,
    setRefreshing,
  };
}

