const esbuild = require('esbuild')

esbuild
  .build({
    entryPoints: ['./test/browser/index.tsx'],
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
  })
  .catch(() => process.exit(1))
