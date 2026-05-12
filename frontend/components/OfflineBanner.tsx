import React from 'react';
import { useNetInfo } from '@react-native-community/netinfo';
import { View, Text, StyleSheet } from 'react-native';

export function OfflineBanner() {
  const info = useNetInfo();
  const offline = info.isConnected === false;
  if (!offline) return null;
  return (
    <View style={styles.container}>
      <Text style={styles.text}>You are offline. Some features may be unavailable.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF4E5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FFD8A8',
  },
  text: { color: '#7A4D00', fontSize: 12, textAlign: 'center', fontWeight: '600' },
});


