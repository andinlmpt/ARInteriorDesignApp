/**
 * AR View route — Unity AR on native, Three.js fallback on web.
 */

import React from 'react';
import { Platform } from 'react-native';
import { ARViewErrorBoundary } from '@/components/ar-view/ARViewErrorBoundary';
import { ARViewScreen } from '@/components/ar-view/ARViewScreen';
import { ARViewUnityScreen } from '@/components/ar-view/ARViewUnityScreen';

export default function ARViewRoute() {
  const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

  return (
    <ARViewErrorBoundary>
      {isNative ? <ARViewUnityScreen /> : <ARViewScreen />}
    </ARViewErrorBoundary>
  );
}
