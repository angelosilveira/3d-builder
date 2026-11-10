import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  css: {
    // Usa apenas a configuração deste projeto, mesmo dentro de outra pasta com PostCSS.
    postcss: { plugins: [] },
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
  },
} as never)
