import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import checker from 'vite-plugin-checker'

export default defineConfig({
  plugins: [vue(), vueJsx(), tsconfigPaths(), checker({ typescript: true })],
  server: {
    port: 1234,
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      external: ['vue'],
    },
  },
})
