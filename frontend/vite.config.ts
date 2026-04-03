import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ShieldRide - Parametric Insurance',
        short_name: 'ShieldRide',
        description: 'AI-Powered Parametric Income Protection for Gig Workers',
        theme_color: '#0d1117',
        background_color: '#0d1117',
        display: 'standalone',
        icons: [
          {
            src: '/shield-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/shield-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})
