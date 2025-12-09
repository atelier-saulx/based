import { readFile } from 'node:fs/promises'
import { join, parse, resolve } from 'node:path'
import type { Plugin } from 'esbuild'
import type { AppContext } from '../../context/index.js'

export const replaceBasedConfigPlugin =
  (context: AppContext) =>
  ({ cloud, url }): Plugin => ({
    name: 'replace-based-config',
    setup(build) {
      if (cloud || !url) {
        context.print.log(
          context.i18n('methods.plugins.cloudFunctions'),
          '<secondary>◆</secondary>',
        )
      } else {
        context.print.log(
          context.i18n('methods.plugins.localFunctions'),
          '<secondary>◆</secondary>',
        )
      }

      build.onResolve({ filter: /[\\\/]based(?:\.(js|ts|json))?$/ }, (args) => {
        const absolutePath = resolve(args.resolveDir, args.path)

        return {
          path: absolutePath,
          namespace: 'replace-based',
        }
      })

      build.onLoad(
        { filter: /.*/, namespace: 'replace-based' },
        async (args) => {
          const extensions = ['.js', '.json', '.ts']
          const { dir, name } = parse(args.path)
          const file = join(dir, name)
          let basedFileFound = false

          do {
            try {
              const source = await readFile(file + extensions[0], 'utf8')

              if (
                source.includes('org') &&
                source.includes('project') &&
                source.includes('env')
              ) {
                basedFileFound = true
              }
            } catch {
              extensions.shift()
            }
          } while (!basedFileFound)

          if (basedFileFound) {
            if (cloud || !url) {
              const { cluster, org, env, project, envDiscoveryUrl } =
                await context.getProgram()
              const contents = `export default ${JSON.stringify({ cluster, org, env, project, discoveryUrls: envDiscoveryUrl })};`

              return {
                contents,
                loader: 'js',
              }
            }

            const contents = `export default ${JSON.stringify({ url })};`

            return {
              contents,
              loader: 'js',
            }
          }
        },
      )
    },
  })
