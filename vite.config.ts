import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = mode === 'production';
    return {
      server: {
        port: 5000,
        host: '0.0.0.0',
        // allowedHosts: true allows any host in dev (needed for tunneling like Replit/ngrok).
        // In production the app is served by Express directly, Vite dev server is not used.
        allowedHosts: isProduction ? [] : (true as any),
      },
      plugins: [react()],
      define: {
        'process.env.NODE_ENV': JSON.stringify(env.NODE_ENV || 'development')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
