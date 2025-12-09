import type { Plugin } from 'esbuild'
import { createRequire } from 'node:module'

export const resolvePlugin: Plugin = {
  name: 'resolve-plugin',
  setup(build) {
    const resolved = {}
    const require = createRequire(import.meta.url)
    const paths = new Set([
      'react',
      'react-dom',
      'react/jsx-runtime',
      'solid-js',
      'solid-js/web',
      'preact',
      'preact/hooks',
      'preact/jsx-runtime',
      'preact/compat',
      'preact/compat/client',
    ])

    build.onResolve(
      { filter: /.*/, namespace: 'file' },
      async ({ path, importer, kind, resolveDir }) => {
        const isBased = path.startsWith('@based/')
        if (isBased || paths.has(path)) {
          resolved[path] ??= build
            .resolve(path, {
              importer,
              kind,
              resolveDir,
            })
            .then((res) => {
              if (res.errors.length && isBased) {
                return build.resolve(require.resolve(path), {
                  importer,
                  kind,
                  resolveDir,
                })
              }
              return res
            })

          return resolved[path]
        }
      },
    )
  },
}
