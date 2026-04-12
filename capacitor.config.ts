import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.arbitrack.trading',
  appName: 'ArbiTrack',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    minSdkVersion: 23,
    targetSdkVersion: 34
  }
};

export default config;
