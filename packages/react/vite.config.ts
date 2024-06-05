import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [],
  server: {
    port: 1234,
  },
  build: {
    target: 'esnext',
  },
})
