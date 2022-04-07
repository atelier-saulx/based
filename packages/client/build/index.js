const { build } = require('esbuild')
const { join } = require('path')

const b = async () => {
  // make a seperate build for stream for both node and the index

  const makeAllPackagesExternalPlugin = {
    name: 'make-all-packages-external',
    setup(build) {
      // eslint-disable-next-line
      const filter = /(\.\/stream)|(^[^.\/]|^\.[^.\/]|^\.\.[^\/])/ // Must not start with "/" or "./" or "../"
      build.onResolve({ filter }, (args) => {
        if (args.path === './stream') {
          return {
            path: './file/stream',
            external: true,
          }
        }

        return {
          path: args.path,
          external: true,
        }
      })
    },
  }

  build({
    outfile: join(__dirname, '../dist/index.js'),
    bundle: true,
    minify: true,
    target: 'es2017',
    platform: 'node',
    entryPoints: [join(__dirname, '../src/index.ts')],
    plugins: [makeAllPackagesExternalPlugin],
  })
}

b()
