/**
 * AR View route entry — thin wrapper around the refactored screen module.
 */

import React from 'react';
import { ARViewErrorBoundary } from '@/components/ar-view/ARViewErrorBoundary';
import { ARViewScreen } from '@/components/ar-view/ARViewScreen';

export default function ARViewRoute() {
  return (
    <ARViewErrorBoundary>
      <ARViewScreen />
    </ARViewErrorBoundary>
  );
}
