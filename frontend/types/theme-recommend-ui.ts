/**
 * Theme Recommend UI Types
 * TypeScript definitions for theme recommendation UI
 */

import type {
  RoomType,
  DesignMood,
  DesignStyle,
  DesignTheme,
  ThemeRecommendationOutput,
  ThemeCollection,
} from '@/types/theme-recommendation';
import type { StepType, BudgetValue } from '@/config/themeRecommend.config';

// ============================================================================
// LOADING STATES
// ============================================================================

export interface LoadingStates {
  generatingImage: boolean;
  savingCollection: boolean;
  exportingPDF: boolean;
  analyzingImage: boolean;
  sharingColorPalette: boolean;
  exportingColorPalette: boolean;
  sharingTheme: boolean;
  exportingAll: boolean;
}

// ============================================================================
// IMAGE ANALYSIS
// ============================================================================

export interface ImageAnalysisResult {
  detectedRoom?: RoomType;
  detectedMood?: DesignMood;
  detectedStyle?: DesignStyle;
  colors?: string[];
  confidence?: number;
}

// ============================================================================
// USER PREFERENCES
// ============================================================================

export interface UserPreferences {
  preferredStyles: DesignStyle[];
  preferredMoods: DesignMood[];
  preferredRooms: RoomType[];
}

// ============================================================================
// GENERATED IMAGE DATA
// ============================================================================

export interface GeneratedImageData {
  imageUrl: string;
  prompt: string;
  generatedAt: number;
}

// ============================================================================
// SELECTION FEEDBACK
// ============================================================================

export interface SelectionFeedback {
  type: 'room' | 'mood' | 'style';
  value: string;
}

// ============================================================================
// SELECTION STATE
// ============================================================================

export interface SelectionState {
  selectedRoom: RoomType | null;
  selectedMood: DesignMood | null;
  selectedStyle: DesignStyle | null;
  selectedBudget: BudgetValue | null;
}

// ============================================================================
// UI STATE
// ============================================================================

export interface ThemeRecommendUIState {
  step: StepType;
  hasSeenWelcome: boolean;
  showTutorial: boolean;
  tutorialStep: number;
  showInteractiveHelp: boolean;
  showThemeStats: boolean;
  comparisonMode: boolean;
  selectedThemesForComparison: string[];
  showCollectionsModal: boolean;
  showCreateCollectionModal: boolean;
  showHistoryFilters: boolean;
  showColorPaletteActions: boolean;
  showPreferenceDashboard: boolean;
  refreshing: boolean;
}

// ============================================================================
// HISTORY STATE
// ============================================================================

export interface HistoryState {
  historyFilter: 'all' | RoomType;
  historySortBy: 'date' | 'confidence' | 'likes';
  searchQuery: string;
  historySearchQuery: string;
}

// ============================================================================
// COLOR STATE
// ============================================================================

export interface ColorState {
  selectedColorModal: { color: string; name: string } | null;
  copiedColorFeedback: string | null;
  favoriteColors: Set<string>;
  selectedColorForImage: string | null;
}

// ============================================================================
// RECOMMENDATION STATE
// ============================================================================

export interface RecommendationState {
  isGenerating: boolean;
  recommendationOutput: ThemeRecommendationOutput | null;
  recentThemes: ThemeRecommendationOutput[];
  historyLoaded: boolean;
  error: string | null;
  cachedRecommendations: Map<string, ThemeRecommendationOutput>;
  likedThemes: Set<string>;
}

// ============================================================================
// IMAGE GENERATION STATE
// ============================================================================

export interface ImageGenerationState {
  generatedImages: Map<string, GeneratedImageData>;
  isGeneratingImage: string | null;
  imageGenerationError: string | null;
}

// ============================================================================
// COLLECTION STATE
// ============================================================================

export interface CollectionState {
  collections: ThemeCollection[];
  newCollectionName: string;
  newCollectionDescription: string;
}

// ============================================================================
// RESULTS DATA
// ============================================================================

export interface ResultsData {
  topTheme: DesignTheme;
  alternativeThemes: DesignTheme[];
  metadata: {
    sessionId: string | null;
    totalThemesAnalyzed: number;
    processingTime: number;
    mlModel: string;
    confidenceLevel: string;
    recommendationDate?: number;
  };
  insights: {
    reasonForRecommendation: string;
    keyMatchingFactors: string[];
  };
  sessionLabel: string;
  confidenceLevel: string;
  totalAnalyzed: number;
  processingTimeSeconds: string;
  modelName: string;
  colorPalette: string[];
  materials: string[];
  decorItems: string[];
  moodScore: number;
  styleScore: number;
  roomScore: number;
  confidenceValue: string;
}

// ============================================================================
// COST BREAKDOWN
// ============================================================================

export interface CostBreakdown {
  total: number;
  breakdown: {
    furniture: number;
    decor: number;
    lighting: number;
    paint: number;
    accessories: number;
  };
}

