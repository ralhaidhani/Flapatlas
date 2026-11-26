import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        manifestFilename: 'manifest.webmanifest',
        includeAssets: [
          'icon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: './',
          name: 'FlapAtlas 3D',
          short_name: 'FlapAtlas',
          description:
            'Interactive 3D anatomical atlas of reconstructive flaps, vascular pedicles, and surgical planning.',
          theme_color: '#0f172a',
          background_color: '#090f1d',
          display: 'standalone',
          orientation: 'any',
          start_url: './',
          scope: './',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          cacheId: 'flapatlas-3d-v12-4',
          cleanupOutdatedCaches: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,json,wasm,glb}'],
          globIgnores: ['**/assets/aistudio/**', '**/models/README.md'],
          maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
          }
        },
      },
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/three')) return 'three-vendor';
            if (id.includes('node_modules/jspdf')) return 'pdf-vendor';
            if (
              id.includes('node_modules/react') ||
              id.includes('node_modules/zustand') ||
              id.includes('node_modules/zod') ||
              id.includes('node_modules/fuse.js')
            ) {
              return 'app-vendor';
            }
          },
        },
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'zustand', 'three', 'lucide-react', 'zod', 'fuse.js', 'idb-keyval'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      allowedHosts: true,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
