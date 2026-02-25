import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Aktüerya Frontend – UTF-8 ve alias ayarlı yapılandırma
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  esbuild: {
    charset: 'utf8',
  },
  server: {
    fs: { strict: false },
  },
  optimizeDeps: {
    esbuildOptions: {
      charset: 'utf8',
    },
  },
});
