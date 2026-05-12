/**
 * SlideInView - Component that slides in from a direction
 */

import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';

type SlideDirection = 'left' | 'right' | 'top' | 'bottom';

interface SlideInViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
  direction?: SlideDirection;
  duration?: number;
  delay?: number;
  distance?: number;
}

export const SlideInView: React.FC<SlideInViewProps> = ({
  children,
  style,
  direction = 'bottom',
  duration = 300,
  delay = 0,
  distance = 50,
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Set initial position based on direction
    const initialX = direction === 'left' ? -distance : direction === 'right' ? distance : 0;
    const initialY = direction === 'top' ? -distance : direction === 'bottom' ? distance : 0;
    
    translateX.setValue(initialX);
    translateY.setValue(initialY);

    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        speed: 50,
        bounciness: 8,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 50,
        bounciness: 8,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateX, translateY, opacity, duration, delay, direction, distance]);

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ translateX }, { translateY }],
          opacity,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};
