const esbuild = require('esbuild');
const { solidPlugin } = require('esbuild-plugin-solid');

esbuild.build({
    entryPoints: ['./test/browser/browser.tsx'],
    bundle: true,
    outfile: './dist/test/browser/browser.js',
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
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    plugins: [solidPlugin()],
}).catch(() => process.exit(1));