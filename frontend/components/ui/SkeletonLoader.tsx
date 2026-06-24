import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

/**
 * Skeleton loader component for better loading states
 * Provides visual feedback during async operations
 */
export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

/**
 * Skeleton screen for AR view initialization
 */
export const ARViewSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      <SkeletonLoader width="100%" height={60} borderRadius={0} style={styles.header} />
      <View style={styles.content}>
        <SkeletonLoader width="90%" height={200} borderRadius={12} style={styles.viewer} />
        <SkeletonLoader width="80%" height={40} borderRadius={8} style={styles.button} />
        <SkeletonLoader width="70%" height={40} borderRadius={8} style={styles.button} />
        <View style={styles.grid}>
          {[1, 2, 3, 4].map((i) => (
            <SkeletonLoader key={i} width="45%" height={100} borderRadius={8} />
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E0E0E0',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    marginBottom: 20,
  },
  content: {
    padding: 20,
  },
  viewer: {
    marginBottom: 20,
  },
  button: {
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 20,
  },
});

