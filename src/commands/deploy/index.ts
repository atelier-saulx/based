import type { BuildFailure, BundleResult } from '@based/bundle'
import type { Command } from 'commander'
import { AppContext } from '../../context/index.js'
import { findConfigFile, parseNumberAndBoolean } from '../../shared/index.js'
import {
  bundlingErrorHandling,
  bundlingUpdateHandling,
} from '../dev/handlers.js'
import { configsBundle } from './configsBundle.js'
import { configsDeploy } from './configsDeploy.js'
import { configsParse } from './configsParse.js'
import { filesBundle } from './filesBundle.js'
import { getBasedFiles } from './getBasedFiles.js'
import { prepareFilesToUpload, uploadFiles } from './peprareUpload.js'
import { schemaDeploy } from './schemaDeploy.js'
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

      const { entryPoints, mapping } = await getBasedFiles(context)
      const bundledConfigs = await configsBundle(
        context,
        functions,
        entryPoints,
        mapping,
      )
      const { configs, node, browser, plugins, favicons } = await configsParse(
        context,
        bundledConfigs,
        entryPoints,
        mapping,
      )

      const { nodeBundles, browserBundles } = await filesBundle(
        context,
        node,
        browser,
        plugins,
        watch && onChange,
        'production',
        publicPath,
        '',
        true,
      )

      const assetsMap: Record<string, string> = {}
      const configsMap: Record<string, number> = {}
      let greetings: boolean = false
      forceReload = parseNumberAndBoolean(forceReload)

      for (const found of configs) {
        await onChange(null, {
          updates: [['bundled', found.path]],
        } as BundleResult)
      }

      async function onChange(err: BuildFailure | null, result?: BundleResult) {
        try {
          const updates = result?.updates

          // const client = basedClient.get('env')
          // const remoteFunctions = (await client
          //   .query('db', {
          //     $db: 'config',
          //     functions: {
          //       id: true,
          //       current: {
          //         id: true,
          //         config: true,
          //         checksum: true,
          //       },
          //       $list: {
          //         $find: {
          //           $traverse: 'children',
          //           $filter: {
          //             $field: 'type',
          //             $operator: '=',
          //             $value: ['job', 'function'],
          //           },
          //         },
          //       },
          //     },
          //   })
          //   .get()) as {
          //   functions: {
          //     id?: string
          //     current?: {
          //       id: string
          //       config: any
          //       checksum: number
          //     }
          //   }[]
          // }

          // const remoteChecksum = remoteFunctions.functions.reduce(
          //   (acc, config) => {
          //     Object.assign(acc, {
          //       [config.current.config.name]: config.current.checksum,
          //     })
          //     return acc
          //   },
          //   {},
          // )

          if (
            err ||
            browserBundles?.error?.errors.length ||
            result?.error?.errors.length
          ) {
            const errors =
              result?.error?.errors || browserBundles?.error?.errors

            if (bundlingErrorHandling(context)(errors)) {
              return
            }
          }

          if (updates?.length) {
            bundlingUpdateHandling(context)(updates)
            for (let [_type, file] of updates) {
              const found = await findConfigFile(file, mapping, nodeBundles)

              if (found) {
                file = found.app || found.index || found.path

                if (!file) {
                  continue
                }

                if (found.type === 'schema') {
                  context.print
                    .intro(context.i18n('methods.schema.unavailable'))
                    .warning(context.i18n('methods.schema.setSchema'))
                    .line()

                  await schemaDeploy(context, found)

                  continue
                }

                if (!found.config.name) {
                  continue
                }

                // if (
                //   found.config.name &&
                //   remoteChecksum[found.config.name] === found.checksum
                // ) {
                //   continue
                // }

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
                  found,
                  nodeBundles,
                  browserBundles,
                  outputs,
                  forceReload,
                  assetsMap,
                  configsMap,
                )

                if (deploys.length) {
                  if (logs.some(Boolean) && !greetings) {
                    greetings = true

                    context.print.intro(
                      context.i18n('commands.deploy.methods.deployLive'),
                    )

                    for (const log of logs) {
                      if (log) {
                        context.print.step(log)
                      }
                    }

                    // context.print.outro(
                    //   context.i18n('commands.deploy.methods.deployComplete'),
                    // )

                    context.print.line()
                  } else {
                    // context.print.outro(
                    //   context.i18n('commands.deploy.methods.deployComplete'),
                    // )
                  }

                  // context.print.line()
                }
              }
            }
          }
        } catch (error) {
          throw error.message
        }
      }

      if (!watch) {
        await basedClient.get('project').destroy()
        process.exit(0)
      }
    },
  )
}
