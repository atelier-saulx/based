import { readFile } from 'node:fs/promises'
import { posix } from 'node:path'
import type { Plugin } from 'esbuild'

export const importMetaURLPlugin: Plugin = {
  name: 'import-meta-url-plugin',
  setup(build) {
    build.onLoad({ filter: /\.[jt]s$/ }, async (args) => {
      if (/[\\\/]based\.(js|ts|json)$/.test(args.path)) {
        return null
      }

      const source = await readFile(args.path, 'utf8')

      if (!source.includes('import.meta.url')) {
        return {
          contents: source,
          loader: args.path.endsWith('.ts') ? 'ts' : 'js',
        }
      }

      const absolutePath = posix.resolve(args.path)
      const resolvedUrl = `file://${absolutePath}`
      const replacement = JSON.stringify(resolvedUrl)
      const newContents = source.replace(/import\.meta\.url/g, replacement)

      return {
        contents: newContents,
        loader: args.path.endsWith('.ts') ? 'ts' : 'js',
      }
    })
  },
}
