import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // `vite preview` serves the build behind the host nginx (../nginx/nginx.conf), which also routes /api
  preview: {
    port: 4173,
    allowedHosts: ['adxcel.amwap.dev'],
  },
})
