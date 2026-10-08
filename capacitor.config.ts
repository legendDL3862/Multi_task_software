import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.dualslot.mobile',
  appName: '双槽',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
}

export default config
