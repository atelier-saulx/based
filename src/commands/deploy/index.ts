import type { BuildFailure, BundleResult } from '@based/bundle'
import type { Command } from 'commander'
import { AppContext } from '../../context/index.js'
import { parseNumberAndBoolean } from '../../shared/index.js'
import {
  bundlingErrorHandling,
  bundlingUpdateHandling,
} from '../dev/handlers.js'
import { configsDeploy } from './configsDeploy.js'
import { configsParse } from './configsParse.js'
import { filesBundle } from './filesBundle.js'
import { prepareFilesToUpload, uploadFiles } from './peprareUpload.js'
import { schemaParse } from './schemaParse.js'
export * from './configsInvalidateCode.js'

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

      const {
        configs,
        favicons,
        nodeEntryPoints,
        browserEntryPoints,
        browserEsbuildPlugins,
      } = await configsParse(context, functions)

      const { nodeBundles, browserBundles } = await filesBundle(
        context,
        nodeEntryPoints,
        browserEntryPoints,
        browserEsbuildPlugins,
        watch && onChange,
        'production',
        publicPath,
        '',
        true,
      )

      const schema = await schemaParse(context, configs, nodeBundles)

      const assetsMap: Record<string, string> = {}
      const configsMap: Record<string, number> = {}
      let greetings: boolean = false
      forceReload = parseNumberAndBoolean(forceReload)

      if (schema) {
        context.print
          .line()
          .intro(context.i18n('methods.schema.unavailable'))
          .pipe()
          .warning(context.i18n('methods.schema.setSchema'))
      }

      await onChange(null)

      if (!watch) {
        await basedClient.get('project').destroy()
      }

      async function onChange(err: BuildFailure | null, result?: BundleResult) {
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

        const { deploys, logs } = await configsDeploy(
          context,
          configs,
          nodeBundles,
          browserBundles,
          outputs,
          forceReload,
          assetsMap,
          configsMap,
        )

        // await schemaDeploy(context, schema, configsMap)

        if (deploys.length) {
          if (logs.some(Boolean) && !greetings) {
            greetings = true

            context.print
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
              .pipe()
              .outro(context.i18n('commands.deploy.methods.deployComplete'))
          }
        }
      }

      if (!watch) {
        process.exit(0)
      }
    },
  )
}
