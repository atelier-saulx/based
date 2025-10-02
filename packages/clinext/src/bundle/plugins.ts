import type { Plugin } from 'esbuild'

export const resolvePlugin: Plugin = {
  name: 'resolve-plugin',
  setup(build) {
    const resolved = {}
    build.onResolve(
      { filter: /.*/, namespace: 'file' },
      async ({ path, importer, kind, resolveDir }) => {
        if (
          path.startsWith('@based/') ||
          path === 'react' ||
          path === 'react-dom' ||
          path === 'solid-js' ||
          path === 'solid-js/web'
        ) {
          resolved[path] ??= build.resolve(path, { importer, kind, resolveDir })
          return resolved[path]
        }
      },
    )
  },
}
