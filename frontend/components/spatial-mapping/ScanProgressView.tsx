/**
 * Scan Progress View Component
 * Shows scanning progress with animations and real-time stats
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import type { ScanStage } from '@/config/spatialMapping.config';
import type { ScanStats } from '@/types/spatial-mapping-ui';

interface ScanProgressViewProps {
  currentStage: ScanStage;
  scanProgress: number;
  scanStats: ScanStats;
  showRealTimeStats: boolean;
}

export function ScanProgressView({
  currentStage,
  scanProgress,
  scanStats,
  showRealTimeStats,
}: ScanProgressViewProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{currentStage.emoji}</Text>
      <Text style={styles.text}>{currentStage.message}</Text>
      
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${scanProgress}%` }]} />
        </View>
        <Text style={styles.progressText}>{Math.round(scanProgress)}%</Text>
      </View>
      
      <ActivityIndicator size="small" color="#34C759" style={styles.spinner} />
      
      {showRealTimeStats && (
        <View style={styles.statsPanel}>
          <View style={styles.statsGrid}>
            <StatItem icon="🧱" value={scanStats.planesDetected} label="Planes" />
            <StatItem icon="🚧" value={scanStats.obstaclesFound} label="Obstacles" />
            <StatItem icon="📊" value={`${Math.round(scanStats.confidence * 100)}%`} label="Confidence" />
            <StatItem icon="⏱️" value={`${(scanStats.processingTime / 1000).toFixed(1)}s`} label="Time" />
          </View>
          
          <View style={styles.stageIndicator}>
            <Text style={styles.stageText}>
              Stage: {currentStage.name.replace('_', ' ').toUpperCase()}
            </Text>
            <View style={styles.stageProgressBar}>
              <View style={[styles.stageProgressFill, { width: `${currentStage.progress}%` }]} />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function StatItem({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  emoji: {
    fontSize: 60,
    marginBottom: 20,
  },
  text: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 20,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#34C759',
    borderRadius: 4,
  },
  progressText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  spinner: {
    marginTop: 10,
  },
  statsPanel: {
    marginTop: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 16,
    width: '100%',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    marginTop: 2,
  },
  stageIndicator: {
    marginTop: 8,
  },
  stageText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },
  stageProgressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
  },
  stageProgressFill: {
    height: '100%',
    backgroundColor: '#34C759',
    borderRadius: 2,
  },
});

