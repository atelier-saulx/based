import { createRequire } from 'node:module'
import type { Plugin } from 'esbuild'

export const wasmPlugin: Plugin = {
  name: 'wasm-plugin',
  setup(build) {
    const require = createRequire(import.meta.url)

    build.onResolve({ filter: /\.wasm$/ }, (args) => {
      try {
        const absolutePath = require.resolve(args.path, {
          paths: [args.resolveDir, process.cwd()],
        })

        return {
          path: args.path,
          namespace: 'wasm-plugin',
          pluginData: { resolvedPath: absolutePath },
        }
      } catch (error) {
        throw new Error(`Failed to resolve WASM path: ${args.path}\n${error}`)
      }
    })

    build.onLoad({ filter: /.*/, namespace: 'wasm-plugin' }, (args) => {
      return {
        contents: `export default "${args.pluginData.resolvedPath}";`,
        loader: 'js',
      }
    })
  },
}
