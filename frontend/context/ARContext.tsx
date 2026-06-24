import React, { createContext, useContext, ReactNode } from 'react';
import { useARFurnitureState } from '../hooks/useARFurnitureState';
import { useARInteractionState } from '../hooks/useARInteractionState';
import { useARUIState } from '../hooks/useARUIState';
import { useARMeasurementState } from '../hooks/useARMeasurementState';
import { useARMarkerTracking } from '../hooks/useARMarkerTracking';
import { useARRefs } from '../hooks/useARRefs';
import { useARCoreState } from '../hooks/useARCoreState';
import { useARHistory } from '../hooks/useARHistory';

export type ARContextType = {
  furnitureState: ReturnType<typeof useARFurnitureState>;
  interactionState: ReturnType<typeof useARInteractionState>;
  uiState: ReturnType<typeof useARUIState>;
  measurementState: ReturnType<typeof useARMeasurementState>;
  markerTracking: ReturnType<typeof useARMarkerTracking>;
  arRefs: ReturnType<typeof useARRefs>;
  coreState: ReturnType<typeof useARCoreState>;
  history: ReturnType<typeof useARHistory>;
};

const ARContext = createContext<ARContextType | null>(null);

export const ARProvider = ({ children }: { children: ReactNode }) => {
  const furnitureState = useARFurnitureState();
  const interactionState = useARInteractionState();
  const uiState = useARUIState();
  const measurementState = useARMeasurementState();
  const markerTracking = useARMarkerTracking();
  const arRefs = useARRefs();
  const coreState = useARCoreState();
  
  // Need to provide furnitureLibraryById to useARHistory
  const furnitureLibraryById = React.useMemo(() => ({}), []); 
  const history = useARHistory(furnitureLibraryById);

  const value = {
    furnitureState,
    interactionState,
    uiState,
    measurementState,
    markerTracking,
    arRefs,
    coreState,
    history
  };

  return <ARContext.Provider value={value}>{children}</ARContext.Provider>;
};

export const useARContext = () => {
  const context = useContext(ARContext);
  if (!context) {
    throw new Error('useARContext must be used within an ARProvider');
  }
  return context;
};
