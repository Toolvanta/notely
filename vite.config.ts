import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        options: resolve(__dirname, 'options.html'),
        sidepanel: resolve(__dirname, 'sidepanel.html'),
        // Service worker (ES module). Shares keys/types/defaults with the UI instead of duplicating them.
        background: resolve(__dirname, 'src/background.ts'),
      },
      output: {
        entryFileNames: (chunk) => chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) return 'assets/[name]-[hash][extname]'
          return 'assets/[name][extname]'
        },
      },
    },
  },
})
