import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.flapatlas.app',
  appName: 'FlapAtlas 3D',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
