import { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import type { RoomType, DesignMood, DesignStyle } from '@/types/theme-recommendation';

const ERROR_MESSAGES = {
  IMAGE_ANALYSIS_ERROR: 'Failed to analyze image. Please try again.',
  IMAGE_ANALYSIS_TIMEOUT: 'Image analysis timed out. Please try again with a smaller image or check your connection.',
  IMAGE_INVALID_FORMAT: 'Invalid image format. Please select a valid image file.',
} as const;

export interface ImageAnalysisResult {
  detectedRoom?: RoomType;
  detectedMood?: DesignMood;
  detectedStyle?: DesignStyle;
  colors?: string[];
  confidence?: number;
}

export const useImageAnalysis = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<ImageAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const analyze = useCallback(async (
    imageUri: string,
    options?: {
      isOffline?: boolean;
      onSuccess?: (result: ImageAnalysisResult) => void;
      onError?: (error: string) => void;
    }
  ) => {
    if (!imageUri || typeof imageUri !== 'string') {
      const errorMsg = 'Please select a valid image file';
      Alert.alert('Invalid Image', errorMsg);
      setError(errorMsg);
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // Note: Currently using mock analysis
      // In production, this should call an actual AI image analysis service:
      // - OpenAI Vision API for room type/style detection
      // - Custom ML model for color extraction
      // - Computer vision service for furniture detection
      // Example: await imageAnalysisService.analyzeRoomImage(imageUri);
      
      // Simulate AI analysis with timeout protection
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Image analysis timed out. Please try again with a smaller image or check your connection.'));
        }, 15000);
        timeoutRefs.current.push(timeoutId);
      });

      const analysisPromise = new Promise<void>((resolve, reject) => {
        const delayId = setTimeout(() => {
          if (options?.isOffline) {
            reject(new Error('Cannot analyze image while offline. Please connect to the internet.'));
          } else {
            resolve();
          }
        }, 2000);
        timeoutRefs.current.push(delayId);
      });

      await Promise.race([analysisPromise, timeoutPromise]);
      
      // Mock analysis results (replace with actual service response)
      const mockAnalysis: ImageAnalysisResult = {
        detectedRoom: 'Living Room' as RoomType,
        detectedMood: 'Cozy' as DesignMood,
        detectedStyle: 'Modern' as DesignStyle,
        colors: ['#8B4513', '#F5DEB3', '#2F4F4F'],
        confidence: 0.85,
      };
      
      if (!mockAnalysis.detectedRoom || !mockAnalysis.detectedMood || !mockAnalysis.detectedStyle) {
        throw new Error('Invalid analysis results received');
      }

      if (!isMountedRef.current) return;

      setResult(mockAnalysis);
      
      if (isMountedRef.current) {
        Alert.alert(
          'Image Analyzed ✅',
          `Detected: ${mockAnalysis.detectedRoom} • ${mockAnalysis.detectedMood} mood • ${mockAnalysis.detectedStyle} style\n\nConfidence: ${Math.round((mockAnalysis.confidence || 0) * 100)}%`,
          [{ text: 'OK' }]
        );
      }
      
      options?.onSuccess?.(mockAnalysis);
    } catch (error) {
      if (!isMountedRef.current) return;
      
      let userMessage: string | undefined;
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
          userMessage = ERROR_MESSAGES.IMAGE_ANALYSIS_TIMEOUT;
        } else if (errorMsg.includes('invalid') || errorMsg.includes('format')) {
          userMessage = ERROR_MESSAGES.IMAGE_INVALID_FORMAT;
        } else {
          userMessage = ERROR_MESSAGES.IMAGE_ANALYSIS_ERROR;
        }
      } else {
        userMessage = ERROR_MESSAGES.IMAGE_ANALYSIS_ERROR;
      }
      
      const errorMessage = error instanceof Error ? error.message : ERROR_MESSAGES.IMAGE_ANALYSIS_ERROR;
      setError(userMessage || errorMessage);
      options?.onError?.(userMessage || errorMessage);
      
      if (isMountedRef.current) {
        Alert.alert('Analysis Error', userMessage || errorMessage);
      }
    } finally {
      // Clean up timeouts
      timeoutRefs.current.forEach(id => clearTimeout(id));
      timeoutRefs.current = [];
      
      if (isMountedRef.current) {
        setIsAnalyzing(false);
      }
    }
  }, []);

  return { isAnalyzing, result, error, analyze };
};

