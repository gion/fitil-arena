import type { CapacitorConfig } from '@capacitor/cli';

// appId e provizoriu: identificatorul final se alege la checkpoint-ul din Faza 8 (vezi docs/questions.md).
const config: CapacitorConfig = {
  appId: 'ro.fitil.arena',
  appName: 'Fuse Arena',
  webDir: 'dist',
  ios: { contentInset: 'never', backgroundColor: '#141726' },
  android: { backgroundColor: '#141726' },
};

export default config;
