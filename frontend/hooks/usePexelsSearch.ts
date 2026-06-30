/**
 * usePexelsSearch Hook
 * Manages Pexels API image search functionality
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { callApi } from '@/services/apiClient';

export interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  src: {
    original: string;
    large: string;
    large2x: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
}

interface UsePexelsSearchReturn {
  photos: PexelsPhoto[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchPhotos: (query: string) => Promise<void>;
  clearResults: () => void;
}

function toInteriorSearchQuery(raw: string): string {
  const q = raw.trim().toLowerCase();
  if (/\b(interior|room|bedroom|kitchen|living|bathroom|furniture|home|decor|house|apartment|office|studio|lobby|lounge)\b/.test(q)) {
    return q;
  }
  return `${q} living room interior design`;
}

export function usePexelsSearch(): UsePexelsSearchReturn {
  const isMountedRef = useRef(true);
  const [photos, setPhotos] = useState<PexelsPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const searchPhotos = useCallback(async (query: string) => {
    if (!query || !query.trim()) {
      Alert.alert('Missing Input', 'Please enter a search term.');
      return;
    }

    const trimmedQuery = query.trim();
    const interiorQuery = toInteriorSearchQuery(trimmedQuery);
    console.log('[PexelsSearch] Searching for (normalized):', interiorQuery);

    setIsLoading(true);
    setError(null);
    setSearchQuery(trimmedQuery);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Use the existing image generation endpoint with custom design text
      const result = await callApi<{
        success: boolean;
        photos?: PexelsPhoto[];
        imageUrl?: string;
        attribution?: {
          photographer?: string;
          photographerUrl?: string;
          source?: string;
        };
        error?: string;
        message?: string;
      }>('/images/generate', {
        method: 'POST',
        body: {
          proposal: {
            id: 'explore-search',
            title: interiorQuery,
            description: interiorQuery,
          },
          preferences: {
            roomType: 'interior',
            style: 'modern',
            colors: [],
            budget: 'medium',
            customDesign: interiorQuery,
            imageSize: '1024x1024',
            quality: 'hd',
            forcePexels: true,
          },
        },
      });

      if (!isMountedRef.current) return;

      if (result.success && result.photos && Array.isArray(result.photos)) {
        // If backend returns multiple photos (Priority)
        setPhotos(result.photos);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (result.success && result.imageUrl) {
        // Convert single image result to photo format
        const photo: PexelsPhoto = {
          id: Date.now(),
          width: 1024,
          height: 1024,
          url: result.imageUrl,
          photographer: result.attribution?.photographer || 'Unknown',
          photographer_url: result.attribution?.photographerUrl || '',
          src: {
            original: result.imageUrl,
            large: result.imageUrl,
            large2x: result.imageUrl,
            medium: result.imageUrl,
            small: result.imageUrl,
            portrait: result.imageUrl,
            landscape: result.imageUrl,
            tiny: result.imageUrl,
          },
        };
        setPhotos([photo]);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        throw new Error(result.message || 'No images found');
      }
    } catch (error) {
      console.error('[PexelsSearch] Error searching photos:', error);

      if (!isMountedRef.current) return;

      let errorMessage = 'Unknown error searching for images';

      if (error instanceof Error) {
        // Check for connection errors
        if (error.message?.includes('Connection refused') ||
          error.message?.includes('ERR_CONNECTION_TIMED_OUT') ||
          error.message?.includes('ERR_CONNECTION_REFUSED')) {
          errorMessage = 'Backend server is not available. Please make sure the backend is running on port 3000.';
        } else if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
          errorMessage = 'Request timed out. The server may be slow or unavailable.';
        } else {
          errorMessage = error.message;
        }
      }

      setError(errorMessage);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      // Only show alert for non-connection errors (connection errors are handled in UI)
      if (!errorMessage.includes('not available') && !errorMessage.includes('timed out')) {
        Alert.alert(
          'Search Failed',
          errorMessage,
          [{ text: 'OK', style: 'default' }]
        );
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const clearResults = useCallback(() => {
    setPhotos([]);
    setSearchQuery('');
    setError(null);
  }, []);

  return {
    photos,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    searchPhotos,
    clearResults,
  };
}
