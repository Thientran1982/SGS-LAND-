import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 5000,
        host: '0.0.0.0',
        allowedHosts: true,
        warmup: {
          clientFiles: [
            './pages/Dashboard.tsx',
            './pages/Leads.tsx',
            './pages/Inbox.tsx',
            './pages/Inventory.tsx',
            './pages/Contracts.tsx',
            './pages/Reports.tsx',
            './pages/ApprovalInbox.tsx',
            './pages/Favorites.tsx',
            './pages/Profile.tsx',
            './pages/RoutingRules.tsx',
            './pages/KnowledgeBase.tsx',
            './components/Layout.tsx',
            './components/Navigation.tsx',
            './components/ContractModal.tsx',
            './components/ListingForm.tsx',
            './services/api/analyticsApi.ts',
            './services/api/leadApi.ts',
            './services/api/contractApi.ts',
            './services/api/listingApi.ts',
          ],
        },
      },
      plugins: [react()],
      define: {
        'process.env.NODE_ENV': JSON.stringify(env.NODE_ENV || 'development')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      optimizeDeps: {
        include: [
          'react',
          'react-dom',
          '@tanstack/react-query',
          'recharts',
          'motion/react',
          'lucide-react',
          '@google/genai',
        ],
      },
      build: {
        // Use esbuild for minification (faster than terser, comparable output)
        minify: 'esbuild',
        target: 'es2018',
        // Raise limit for intentionally-large lazy chunks (exceljs, jspdf)
        chunkSizeWarningLimit: 1000,
        // Enable CSS code splitting so each chunk only loads the CSS it needs
        cssCodeSplit: true,
        // Preload all chunks by default (modulepreload improves LCP on SPA)
        modulePreload: { polyfill: true },
        rollupOptions: {
          output: {
            manualChunks: {
              'vendor-react': ['react', 'react-dom'],
              'vendor-query': ['@tanstack/react-query'],
              'vendor-charts': ['recharts'],
              'vendor-motion': ['motion/react'],
              'vendor-icons': ['lucide-react'],
              'pages-enterprise': [
                './pages/AdminUsers',
                './pages/EnterpriseSettings',
                './pages/SecurityCompliance',
                './pages/AiGovernance',
                './pages/DataPlatform',
                './pages/Marketplace',
                './pages/Billing',
                './pages/SystemStatus',
              ],
            },
          },
        },
      },
    };
});
