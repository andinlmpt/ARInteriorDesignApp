/**
 * AI Design UI State Hook
 * Manages UI-related state (filters, sorting, favorites, etc.)
 */

import { useState, useCallback, useEffect } from 'react';
import type {
  ImageQuality,
  ImageStyle,
  PhilippineStore,
  SortOption,
  SortOrder
} from '@/types/ai-design-ui';
import { saveFavorites, loadFavorites } from '@/utils/aiDesignStorage';

export function useAIDesignUI() {
  // Image settings
  const [imageQuality, setImageQuality] = useState<ImageQuality>('standard');
  const [imageStyle, setImageStyle] = useState<ImageStyle>('photorealistic');
  const [designImages, setDesignImages] = useState<Record<string, string>>({});
  const [generatingImages, setGeneratingImages] = useState<Record<string, boolean>>({});
  const [savingImage, setSavingImage] = useState<Record<string, boolean>>({});

  // Filtering and sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [costRange, setCostRange] = useState<{ min: number; max: number } | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('none');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Favorites
  const [favoriteDesigns, setFavoriteDesigns] = useState<Set<string>>(new Set());

  // Comparison mode
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);

  // Modals and overlays
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareDesignId, setShareDesignId] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDesignId, setExportDesignId] = useState<string | null>(null);
  const [showShoppingModal, setShowShoppingModal] = useState(false);
  const [shoppingDesignId, setShoppingDesignId] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<PhilippineStore>('all');
  const [showTutorial, setShowTutorial] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // 3D and AR features
  const [show3DPreview, setShow3DPreview] = useState(false);
  const [showARPreview, setShowARPreview] = useState(false);
  const [selectedDesignFor3D, setSelectedDesignFor3D] = useState<any | null>(null);

  // Floor plan controls
  const [floorPlanScale, setFloorPlanScale] = useState(1);
  const [floorPlanOffset, setFloorPlanOffset] = useState({ x: 0, y: 0 });
  const [floorPlanRotation, setFloorPlanRotation] = useState(0);

  // Load favorites on mount
  useEffect(() => {
    const loadFavs = async () => {
      const favs = await loadFavorites();
      setFavoriteDesigns(favs);
    };
    loadFavs();
  }, []);

  // Save favorites when they change
  useEffect(() => {
    saveFavorites(favoriteDesigns);
  }, [favoriteDesigns]);

  // Toggle favorite
  const toggleFavorite = useCallback((designId: string) => {
    setFavoriteDesigns(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(designId)) {
        newFavorites.delete(designId);
      } else {
        newFavorites.add(designId);
      }
      return newFavorites;
    });
  }, []);

  // Toggle comparison selection
  const toggleComparisonSelection = useCallback((designId: string) => {
    setSelectedForComparison(prev => {
      if (prev.includes(designId)) {
        return prev.filter(id => id !== designId);
      } else if (prev.length < 3) {
        return [...prev, designId];
      }
      return prev;
    });
  }, []);

  // Clear comparison
  const clearComparison = useCallback(() => {
    setSelectedForComparison([]);
    setCompareMode(false);
  }, []);

  // Reset filters
  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setCostRange(null);
    setSortBy('none');
    setSortOrder('desc');
    setCurrentPage(1);
  }, []);

  return useMemo(() => ({
    // Image settings
    imageQuality,
    setImageQuality,
    imageStyle,
    setImageStyle,
    designImages,
    setDesignImages,
    generatingImages,
    setGeneratingImages,
    savingImage,
    setSavingImage,

    // Filtering and sorting
    searchQuery,
    setSearchQuery,
    costRange,
    setCostRange,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    showFilters,
    setShowFilters,
    resetFilters,

    // Pagination
    currentPage,
    setCurrentPage,

    // Favorites
    favoriteDesigns,
    toggleFavorite,

    // Comparison
    compareMode,
    setCompareMode,
    selectedForComparison,
    toggleComparisonSelection,
    clearComparison,

    // Modals
    showShareModal,
    setShowShareModal,
    shareDesignId,
    setShareDesignId,
    showExportModal,
    setShowExportModal,
    exportDesignId,
    setExportDesignId,
    showShoppingModal,
    setShowShoppingModal,
    shoppingDesignId,
    setShoppingDesignId,
    selectedStore,
    setSelectedStore,
    showTutorial,
    setShowTutorial,
    activeTooltip,
    setActiveTooltip,

    // 3D/AR
    show3DPreview,
    setShow3DPreview,
    showARPreview,
    setShowARPreview,
    selectedDesignFor3D,
    setSelectedDesignFor3D,

    // Floor plan
    floorPlanScale,
    setFloorPlanScale,
    floorPlanOffset,
    setFloorPlanOffset,
    floorPlanRotation,
    setFloorPlanRotation,
  }), [
    imageQuality,
    imageStyle,
    designImages,
    generatingImages,
    savingImage,
    searchQuery,
    costRange,
    sortBy,
    sortOrder,
    showFilters,
    resetFilters,
    currentPage,
    favoriteDesigns,
    toggleFavorite,
    compareMode,
    selectedForComparison,
    toggleComparisonSelection,
    clearComparison,
    showShareModal,
    shareDesignId,
    showExportModal,
    exportDesignId,
    showShoppingModal,
    shoppingDesignId,
    selectedStore,
    showTutorial,
    activeTooltip,
    show3DPreview,
    showARPreview,
    selectedDesignFor3D,
    floorPlanScale,
    floorPlanOffset,
    floorPlanRotation,
  ]);
}

