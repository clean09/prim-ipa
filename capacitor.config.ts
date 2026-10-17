import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.primsieb.mobile',
  appName: 'PrimSieb',
  webDir: 'dist',
  backgroundColor: '#0e0f12',
  android: { backgroundColor: '#0e0f12' },
  ios: { backgroundColor: '#0e0f12', contentInset: 'never' },
  plugins: {
    SplashScreen: { launchShowDuration: 600, backgroundColor: '#0e0f12', showSpinner: false },
    StatusBar: { style: 'DARK', backgroundColor: '#0e0f12', overlaysWebView: false },
  },
};

export default config;
