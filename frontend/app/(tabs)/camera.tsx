import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii } from '@/components/ui/theme';
import { getHorizontalPadding } from '@/utils/responsive';

export default function CameraScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const startCamera = async () => {
    // Navigate to live scan screen instead
    router.push('/live-scan');
  };

  const captureAndAnalyze = async () => {
    if (!cameraRef.current) return;

    try {
      setIsProcessing(true);
      
      // Capture photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });

      // Navigate to spatial mapping with the captured image
      router.push({
        pathname: '/spatial-mapping',
        params: { imageUri: photo.uri },
      });
    } catch (error) {
      console.error('Error capturing image:', error);
      Alert.alert('Error', 'Failed to capture image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const goToARView = () => {
    router.push('/ar-view');
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.content}>
          <Text style={styles.title}>Loading Camera...</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted && !isCameraActive) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="camera-outline" size={64} color={colors.textPrimary} />
          </View>
          <Text style={styles.title}>Camera Permission</Text>
          <Text style={styles.subtitle}>
            Camera access is needed to scan rooms and place furniture in AR
          </Text>
          <TouchableOpacity style={styles.startButton} onPress={requestPermission} activeOpacity={0.8}>
            <Text style={styles.startButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isCameraActive) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          {/* Top Controls */}
          <View style={styles.topControls}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsCameraActive(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>

          {/* Scanning Instructions */}
          <View style={styles.instructionsOverlay}>
            <View style={styles.instructionIconContainer}>
              <Ionicons name="scan-outline" size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.instructionText}>Scan Room Dimensions</Text>
            <Text style={styles.instructionSubtext}>
              Point camera at walls, corners, and obstacles
            </Text>
          </View>

          {/* Bottom Controls */}
          <View style={styles.bottomControls}>
            <TouchableOpacity
              style={[styles.captureButton, isProcessing && styles.captureButtonDisabled]}
              onPress={captureAndAnalyze}
              disabled={isProcessing}
            >
              <View style={styles.captureButtonInner}>
                {isProcessing ? (
                  <Text style={styles.processingText}>Processing...</Text>
                ) : (
                  <Ionicons name="camera" size={32} color={colors.accent} />
                )}
              </View>
            </TouchableOpacity>
            <Text style={styles.captureHint}>
              {isProcessing ? 'Analyzing room...' : 'Tap to capture and analyze'}
            </Text>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="camera-outline" size={64} color={colors.textPrimary} />
        </View>
        <Text style={styles.title}>AR Camera</Text>
        <Text style={styles.subtitle}>Choose an AR feature to get started</Text>
        
        <TouchableOpacity style={styles.startButton} onPress={startCamera} activeOpacity={0.8}>
          <Ionicons name="scan-outline" size={20} color="#FFFFFF" style={styles.buttonIcon} />
          <Text style={styles.startButtonText}>Scan Room Dimensions</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.startButton, styles.secondaryButton]} 
          onPress={goToARView}
          activeOpacity={0.8}
        >
          <Ionicons name="cube-outline" size={20} color="#FFFFFF" style={styles.buttonIcon} />
          <Text style={styles.startButtonText}>Place Furniture in AR</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: getHorizontalPadding(spacing.xl * 2),
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: radii.lg,
    backgroundColor: colors.surfacePrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xxl * 1.5,
  },
  startButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.lg,
    paddingHorizontal: getHorizontalPadding(spacing.xl * 2),
    borderRadius: radii.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  secondaryButton: {
    backgroundColor: colors.success,
  },
  buttonIcon: {
    marginRight: spacing.xs,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  camera: {
    flex: 1,
  },
  topControls: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  closeButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: getHorizontalPadding(spacing.lg),
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionsOverlay: {
    position: 'absolute',
    top: '40%',
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  instructionIconContainer: {
    marginBottom: spacing.md,
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
    ...(Platform.OS === 'web' 
      ? { textShadow: '0px 2px 4px rgba(0, 0, 0, 0.75)' }
      : { textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }
    ),
  },
  instructionSubtext: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    ...(Platform.OS === 'web' 
      ? { textShadow: '0px 1px 3px rgba(0, 0, 0, 0.75)' }
      : { textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }
    ),
  },
  bottomControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.accent,
  },
  captureHint: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 12,
    ...(Platform.OS === 'web' 
      ? { textShadow: '0px 1px 3px rgba(0, 0, 0, 0.75)' }
      : { textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }
    ),
  },
});
