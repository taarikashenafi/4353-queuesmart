import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      provider: 'v8',
      include: ['server/**/*.js'],
      exclude: ['server/tests/**', 'server/index.js', 'server/store.js'],
    },
  },
})
