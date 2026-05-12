/**
 * FadeInView - Component that fades in on mount
 */

import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';

interface FadeInViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
  duration?: number;
  delay?: number;
  from?: number;
  to?: number;
}

export const FadeInView: React.FC<FadeInViewProps> = ({
  children,
  style,
  duration = 300,
  delay = 0,
  from = 0,
  to = 1,
}) => {
  const fadeAnim = useRef(new Animated.Value(from)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: to,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, duration, delay, to]);

  return (
    <Animated.View style={[style, { opacity: fadeAnim }]}>
      {children}
    </Animated.View>
  );
};
