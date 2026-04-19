import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['**/*'],
      manifest: {
        name: 'LeafTag',
        short_name: 'LeafTag',
        description: 'Coleta rápida e eficiente de dados florestais',
        theme_color: '#1a1f1c',
        background_color: '#1a1f1c',
        display: 'standalone',
        icons: []
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        maximumFileSizeToCacheInBytes: 5000000
      }
    })
  ],
})
