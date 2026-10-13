import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import appConfig from '../../vite.config';

export default defineConfig({
  ...appConfig,
  build: {
    outDir: '.qa-dist',
    rollupOptions: {
      input: {
        app: fileURLToPath(new URL('../../index.html', import.meta.url)),
        iosQa: fileURLToPath(new URL('./ios-reliability.html', import.meta.url)),
      },
    },
  },
});
