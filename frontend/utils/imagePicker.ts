/**
 * Web-compatible image picker utility
 * Works on both web and native platforms
 */

import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export interface ImagePickerResult {
  canceled: boolean;
  assets?: Array<{
    uri: string;
    width: number;
    height: number;
    type?: string;
    fileName?: string;
  }>;
}

/**
 * Request media library permissions
 */
export async function requestMediaLibraryPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    // Web doesn't need permissions for file input
    return true;
  }

  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('[ImagePicker] Error requesting media library permissions:', error);
    return false;
  }
}

/**
 * Request camera permissions
 */
export async function requestCameraPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    // Web doesn't need permissions for camera (handled by browser)
    return true;
  }

  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('[ImagePicker] Error requesting camera permissions:', error);
    return false;
  }
}

/**
 * Launch image library picker (web-compatible)
 */
export async function launchImageLibrary(options: {
  mediaTypes?: 'images' | 'videos' | 'all';
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
}): Promise<ImagePickerResult> {
  if (Platform.OS === 'web') {
    return launchWebImagePicker(options);
  }

  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: options.mediaTypes === 'images' 
        ? ImagePicker.MediaTypeOptions.Images 
        : options.mediaTypes === 'videos'
        ? ImagePicker.MediaTypeOptions.Videos
        : ImagePicker.MediaTypeOptions.All,
      allowsEditing: options.allowsEditing ?? false,
      aspect: options.aspect,
      quality: options.quality ?? 1.0,
    });

    return {
      canceled: result.canceled,
      assets: result.canceled ? undefined : result.assets?.map(asset => ({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        type: asset.type,
        fileName: asset.fileName,
      })),
    };
  } catch (error) {
    console.error('[ImagePicker] Error launching image library:', error);
    return { canceled: true };
  }
}

/**
 * Launch camera (web-compatible)
 */
export async function launchCamera(options: {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
}): Promise<ImagePickerResult> {
  if (Platform.OS === 'web') {
    // On web, fallback to file input (camera access requires getUserMedia which is more complex)
    return launchWebImagePicker({
      ...options,
      mediaTypes: 'images',
    });
  }

  try {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: options.allowsEditing ?? false,
      aspect: options.aspect,
      quality: options.quality ?? 1.0,
    });

    return {
      canceled: result.canceled,
      assets: result.canceled ? undefined : result.assets?.map(asset => ({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        type: asset.type,
        fileName: asset.fileName,
      })),
    };
  } catch (error) {
    console.error('[ImagePicker] Error launching camera:', error);
    return { canceled: true };
  }
}

/**
 * Web implementation using file input
 */
function launchWebImagePicker(options: {
  mediaTypes?: 'images' | 'videos' | 'all';
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
}): Promise<ImagePickerResult> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = options.mediaTypes === 'images' 
      ? 'image/*' 
      : options.mediaTypes === 'videos'
      ? 'video/*'
      : 'image/*,video/*';
    
    input.style.display = 'none';
    document.body.appendChild(input);

    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      
      if (!file) {
        document.body.removeChild(input);
        resolve({ canceled: true });
        return;
      }

      // Check if it's an image
      if (!file.type.startsWith('image/')) {
        document.body.removeChild(input);
        resolve({ canceled: true });
        return;
      }

      const reader = new FileReader();
      
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        
        // Create an image to get dimensions
        const img = new Image();
        img.onload = () => {
          // If allowsEditing and aspect are specified, we'd need to crop
          // For now, just return the image as-is
          // In a real implementation, you'd use a canvas to crop
          
          document.body.removeChild(input);
          
          resolve({
            canceled: false,
            assets: [{
              uri: dataUrl,
              width: img.width,
              height: img.height,
              type: file.type,
              fileName: file.name,
            }],
          });
        };
        
        img.onerror = () => {
          document.body.removeChild(input);
          resolve({ canceled: true });
        };
        
        img.src = dataUrl;
      };
      
      reader.onerror = () => {
        document.body.removeChild(input);
        resolve({ canceled: true });
      };
      
      reader.readAsDataURL(file);
    };

    input.oncancel = () => {
      document.body.removeChild(input);
      resolve({ canceled: true });
    };

    // Trigger file picker
    input.click();
  });
}
