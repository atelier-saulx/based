import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import tsconfigPaths from 'vite-tsconfig-paths'
// import devtools from 'solid-devtools/vite';

export default defineConfig({
  plugins: [
    // devtools(),
    solidPlugin(),
    tsconfigPaths()
  ],
  server: {
    port: 1234,
  },
  build: {
    target: 'esnext',
  },
});
