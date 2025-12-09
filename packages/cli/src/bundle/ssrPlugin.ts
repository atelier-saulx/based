import { readFile } from 'node:fs/promises'
import type { Plugin } from 'esbuild'
import { optimize } from 'inlines/ssr'

export const ssrPlugin: Plugin = {
  name: 'ssr-plugin',
  setup(build) {
    build.onResolve({ filter: /.ssr-plugin$/ }, async (args) => ({
      path: args.path,
      namespace: 'ssr-plugin',
    }))

    build.onLoad(
      { filter: /.ssr-plugin$/, namespace: 'ssr-plugin' },
      async (args) => {
        return {
          contents: args.path.slice(0, -11),
          loader: 'css',
        }
      },
    )

    build.onLoad({ filter: /.tsx$/, namespace: 'file' }, async (args) => {
      let contents = (await readFile(args.path)).toString()

      if (/ from ('inlines'|"inlines")/.test(contents)) {
        const { js, css } = optimize(contents)
        if (css) {
          const splitCss = css.split('}.')
          const last = splitCss.length - 1
          const imports = splitCss.map((str, i) =>
            str
              ? `import '${i ? '.' : ''}${str}${
                  i === last ? '' : '}'
                }.ssr-plugin'\n`
              : '',
          )
          contents = `${imports.join('')}${js}`
        }
      }

      return {
        contents,
        loader: 'tsx',
      }
    })
  },
}
