import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [solidPlugin(), tsconfigPaths()],
  server: {
    port: 1234,
  },
  build: {
    target: 'esnext',
  },
})
