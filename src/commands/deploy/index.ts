import type { BuildFailure, BundleResult } from '@based/bundle'
import type { Command } from 'commander'
import { AppContext } from '../../context/index.js'
import { parseNumberAndBoolean } from '../../shared/index.js'
import {
  bundlingErrorHandling,
  bundlingUpdateHandling,
} from '../dev/handlers.js'
import { parseFunctions } from './parseFunctions.js'
import { prepareFilesToUpload, uploadFiles } from './peprareUpload.js'
import { prepareFilesToDeploy } from './prepareDeploy.js'
import { queuedFnDeploy } from './queues.js'
export * from './invalidateFunctionCode.js'

export const deploy = async (program: Command) => {
  const context: AppContext = AppContext.getInstance(program)
  const cmd: Command = context.commandMaker('deploy')

  cmd.action(
    async ({ functions, watch, forceReload }: Based.Deploy.Command) => {
      const context: AppContext = AppContext.getInstance(program)
      await context.getProgram()
      const basedClient = await context.getBasedClient()
      const { publicPath } = await basedClient
        .get('project')
        .call('based:env-info')
      const { nodeBundles, browserBundles, schemaPath, favicons, configs } =
        await parseFunctions(
          context,
          functions,
          watch && update,
          publicPath,
          '',
          'production',
        )

      const assetsMap: Record<string, string> = {}
      const functionsMap: Record<string, number> = {}
      let previous = new Set<string | number>()
      let greetings: boolean = false
      forceReload = parseNumberAndBoolean(forceReload)

      if (schemaPath) {
        context.print
          .line()
          .intro('<yellow>Schema unavailable</yellow>')
          .pipe()
          .warning(
            `The 'db:set-schema' function is not available in the cloud at the moment. Please set the schema manually.`,
          )
      }

      await update(null)

      if (!watch) {
        await basedClient.get('project').destroy()
      }

      async function update(err: BuildFailure | null, result?: BundleResult) {
        if (result?.updates.length) {
          const updates = result?.updates

          bundlingUpdateHandling(context)(updates)
        }

        if (
          err ||
          browserBundles?.error?.errors.length ||
          result?.error?.errors.length
        ) {
          const errors = result?.error?.errors || browserBundles?.error?.errors

          if (bundlingErrorHandling(context)(errors)) {
            return
          }
        }

        context.print.line()

        const deployed: typeof previous = new Set()

        const assets = browserBundles.result.outputFiles
        const { outputs } = browserBundles.result.metafile

        const uploads = prepareFilesToUpload(
          assets,
          favicons,
          outputs,
          assetsMap,
        )

        if (uploads.length) {
          await uploadFiles(context)(uploads, publicPath, assetsMap)
        }

        const deploys = prepareFilesToDeploy(
          configs,
          nodeBundles,
          browserBundles,
          outputs,
          forceReload,
          assetsMap,
          functionsMap,
        )

        if (deploys.length) {
          let deploying = 0
          let url = basedClient
            .get('project')
            .connection?.ws.url.replace('ws://', 'http://')
            .replace('wss://', 'https://')

          url = url.substring(0, url.lastIndexOf('/'))

          context.spinner.start(
            context.i18n(
              'commands.deploy.methods.deployed',
              deploying,
              deploys.length,
            ),
          )

          const logs = await Promise.all(
            deploys.map(async ({ checksum, config, js, sourcemap, path }) => {
              await queuedFnDeploy(
                context,
                basedClient.get('project'),
                checksum,
                config,
                js,
                sourcemap,
              )

              functionsMap[path] = checksum

              context.spinner.message = context.i18n(
                'commands.deploy.methods.deployed',
                ++deploying,
                deploys.length,
              )

              const { finalPath = `/${config.name}`, public: isPublic } = config

              if (isPublic) {
                return `<dim>${url}</dim>${finalPath}`
              }
            }),
          )

          if (logs.some(Boolean) && !greetings) {
            greetings = true

            context.print
              .success(
                context.i18n(
                  'commands.deploy.methods.deployed',
                  deploying,
                  deploys.length,
                ),
              )
              .line()
              .intro(context.i18n('commands.deploy.methods.deployLive'))
              .pipe()

            for (const log of logs) {
              if (log) {
                context.print.step(log)
              }
            }

            context.print
              .pipe()
              .outro(context.i18n('commands.deploy.methods.deployComplete'))
          } else {
            context.print
              .success(
                context.i18n(
                  'commands.deploy.methods.deployed',
                  deploying,
                  deploys.length,
                ),
              )
              .pipe()
              .outro(context.i18n('commands.deploy.methods.deployComplete'))
          }
        }

        previous = deployed
      }

      if (!watch) {
        process.exit(0)
      }
    },
  )
}
