const esbuild = require('esbuild')
const vuePlugin = require('esbuild-plugin-vue3')

esbuild
  .build({
    entryPoints: ['./test/browser/index.ts'],
    bundle: true,
    outfile: './dist/test/browser/index.js',
    minify: true,
    sourcemap: true,
    target: 'ESNext',
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    loader: {
      '.js': 'jsx',
      '.ts': 'ts',
      '.tsx': 'tsx',
    },
    plugins: [vuePlugin()],
  })
  .catch(() => process.exit(1))
