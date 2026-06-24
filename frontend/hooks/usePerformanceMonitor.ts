import { useEffect } from 'react';

/**
 * Custom hook for monitoring performance metrics
 * Only runs in development mode to avoid production overhead
 * 
 * @param threshold - FPS threshold below which to warn (default: 30)
 * @param enabled - Whether monitoring is enabled (default: true in dev mode)
 */
export const usePerformanceMonitor = (
  threshold: number = 30,
  enabled: boolean = typeof __DEV__ !== 'undefined' ? __DEV__ : false
) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const times: number[] = [];

    const measureFrame = () => {
      const start = performance.now();
      
      requestAnimationFrame(() => {
        const end = performance.now();
        const frameTime = end - start;
        
        times.push(frameTime);
        if (times.length > 60) {
          times.shift();
        }
        
        const avgFrameTime = times.reduce((a, b) => a + b, 0) / times.length;
        const avgFPS = 1000 / avgFrameTime;
        
        if (avgFPS < threshold) {
          console.warn(`[Performance] Low FPS: ${avgFPS.toFixed(1)}`);
        }
      });
    };

    const interval = setInterval(measureFrame, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [threshold, enabled]);
};

