import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, PanResponder } from 'react-native';

interface UseARViewBottomSheetOptions {
  libraryPanelVisible: boolean;
  setLibraryPanelVisible: (visible: boolean) => void;
}

export function useARViewBottomSheet({
  libraryPanelVisible,
  setLibraryPanelVisible,
}: UseARViewBottomSheetOptions) {
  const screenHeight = Dimensions.get('window').height;
  const maxPanelHeightLimit = screenHeight * 0.75;
  const collapsedHeight = 60;
  const [measuredContentHeight, setMeasuredContentHeight] = useState(400);

  const targetExpandedHeight = useMemo(() => {
    const calculated = measuredContentHeight + 80;
    return Math.min(maxPanelHeightLimit, Math.max(collapsedHeight + 100, calculated));
  }, [measuredContentHeight, maxPanelHeightLimit, collapsedHeight]);

  const maxPanelHeight = targetExpandedHeight;
  const bottomSheetHeight = useRef(new Animated.Value(collapsedHeight)).current;
  const bottomSheetOpacity = useRef(new Animated.Value(1)).current;
  const currentHeightRef = useRef(collapsedHeight);
  const isDragging = useRef(false);
  const dragStartHeightRef = useRef(0);

  useEffect(() => {
    if (isDragging.current) return;

    if (libraryPanelVisible) {
      currentHeightRef.current = maxPanelHeight;
      Animated.parallel([
        Animated.spring(bottomSheetHeight, {
          toValue: maxPanelHeight,
          useNativeDriver: false,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(bottomSheetOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      currentHeightRef.current = collapsedHeight;
      Animated.parallel([
        Animated.spring(bottomSheetHeight, {
          toValue: collapsedHeight,
          useNativeDriver: false,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(bottomSheetOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [
    libraryPanelVisible,
    screenHeight,
    maxPanelHeight,
    collapsedHeight,
    bottomSheetHeight,
    bottomSheetOpacity,
  ]);

  const bottomSheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 3 &&
        Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 0.5,
      onPanResponderGrant: () => {
        isDragging.current = true;
        bottomSheetHeight.stopAnimation((value) => {
          const startHeight = value || (libraryPanelVisible ? maxPanelHeight : collapsedHeight);
          dragStartHeightRef.current = startHeight;
          currentHeightRef.current = startHeight;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const startHeight = dragStartHeightRef.current || currentHeightRef.current;
        const newValue = startHeight - gestureState.dy;
        const clampedValue = Math.max(collapsedHeight, Math.min(maxPanelHeight, newValue));
        bottomSheetHeight.setValue(clampedValue);
        currentHeightRef.current = clampedValue;
      },
      onPanResponderRelease: (_, gestureState) => {
        isDragging.current = false;
        const finalValue = currentHeightRef.current;
        const closingThreshold = collapsedHeight + (maxPanelHeight - collapsedHeight) * 0.25;
        const expansionThreshold = collapsedHeight + (maxPanelHeight - collapsedHeight) * 0.75;
        const shouldExpand =
          (finalValue > expansionThreshold && !libraryPanelVisible) || gestureState.vy < -0.5;
        const shouldCollapse =
          (finalValue < closingThreshold && libraryPanelVisible) || gestureState.vy > 0.5;

        if (shouldExpand && !libraryPanelVisible) {
          setLibraryPanelVisible(true);
        } else if (shouldCollapse && libraryPanelVisible) {
          setLibraryPanelVisible(false);
        } else {
          Animated.spring(bottomSheetHeight, {
            toValue: libraryPanelVisible ? maxPanelHeight : collapsedHeight,
            useNativeDriver: false,
            tension: 65,
            friction: 11,
          }).start(() => {
            currentHeightRef.current = libraryPanelVisible ? maxPanelHeight : collapsedHeight;
          });
        }
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
        Animated.spring(bottomSheetHeight, {
          toValue: libraryPanelVisible ? maxPanelHeight : collapsedHeight,
          useNativeDriver: false,
          tension: 65,
          friction: 11,
        }).start(() => {
          currentHeightRef.current = libraryPanelVisible ? maxPanelHeight : collapsedHeight;
        });
      },
    })
  ).current;

  return {
    bottomSheetHeight,
    bottomSheetOpacity,
    bottomSheetPanResponder,
    collapsedHeight,
    maxPanelHeight,
    measuredContentHeight,
    setMeasuredContentHeight,
  };
}
