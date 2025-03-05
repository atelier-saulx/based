import type { Plugin } from '@based/bundle'
import type { AppContext } from '../../context/index.js'

export const replaceBasedConfigPlugin =
  (context: AppContext) =>
  ({ cloud, url }): Plugin => ({
    name: 'replace-based-config',
    setup(build) {
      build.onResolve({ filter: /[\\\/]based\.(js|ts|json)$/ }, (args) => {
        return { path: args.path, namespace: 'replace-based' }
      })

      build.onLoad({ filter: /.*/, namespace: 'replace-based' }, async () => {
        if (cloud || !url) {
          context.print
            .pipe()
            .log(
              context.i18n('methods.plugins.cloudFunctions'),
              '<secondary>◆</secondary>',
            )
            .pipe()

          const { cluster, org, env, project } = await context.getProgram()
          const contents = `export default ${JSON.stringify({ cluster, org, env, project })};`

          return {
            contents,
            loader: 'js',
          }
        }

        const contents = `export default ${JSON.stringify({ url })};`

        context.print
          .pipe()
          .log(
            context.i18n('methods.plugins.localFunctions'),
            '<secondary>◆</secondary>',
          )
          .pipe()

        return {
          contents,
          loader: 'js',
        }
      })
    },
  })
