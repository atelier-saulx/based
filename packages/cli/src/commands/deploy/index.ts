import type { Command } from 'commander'
import { AppContext } from '../../context/index.js'
import { findConfigFile, parseNumberAndBoolean } from '../../shared/index.js'
import {
  bundlingErrorHandling,
  bundlingUpdateHandling,
} from '../dev/handlers.js'
import { configsBundle } from './configsBundle.js'
import { configsChecksumCheck, configsDeploy } from './configsDeploy.js'
import { configsParse } from './configsParse.js'
import { filesBundle } from './filesBundle.js'
import { getBasedFiles } from './getBasedFiles.js'
import { prepareFilesToUpload, uploadFiles } from './peprareUpload.js'
import { schemaDeploy } from './schemaDeploy.js'
import type { BundleResult } from '../../bundle/BundleResult.js'
import type { BuildFailure } from 'esbuild'
export * from './configsInvalidateCode.js'

export const deploy = async (program: Command) => {
  const context: AppContext = AppContext.getInstance(program)
  const cmd: Command = context.commandMaker('deploy')

  cmd.action(
    async ({
      functions,
      watch,
      forceReload,
      functionsOnly,
      schemaOnly,
    }: Based.Deploy.Command) => {
      const context: AppContext = AppContext.getInstance(program)
      if (functionsOnly && schemaOnly) {
        context.print.error('Please specify either functionsOnly or schemaOnly')
        process.exit(1)
      }
      const { cluster } = await context.getProgram()
      const basedClient = await context.getBasedClient()
      const { publicPath } = await basedClient
        .get('project')
        .call('based:env-info')

      const { entryPoints, mapping } = await getBasedFiles(context, {
        functionsOnly,
        schemaOnly,
      })

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
      forceReload = forceReload
        ? parseNumberAndBoolean(forceReload)
        : watch
          ? 10
          : 0

      context.print.line()
      for (const found of configs) {
        await onChange(null, {
          updates: [['bundled', found.path]],
        } as BundleResult)
      }

      async function onChange(err: BuildFailure | null, result?: BundleResult) {
        try {
          let deployed: boolean = false
          let deployType: string = ''
          const updates = result?.updates

          const client = basedClient.get('env')
          const remoteFunctions = (await client
            .query('db', {
              $db: 'config',
              functions: {
                id: true,
                current: {
                  id: true,
                  config: true,
                  checksum: true,
                },
                $list: {
                  $find: {
                    $traverse: 'children',
                    $filter: {
                      $field: 'type',
                      $operator: '=',
                      $value: ['job', 'function'],
                    },
                  },
                },
              },
            })
            .get()) as {
            functions: {
              id?: string
              current?: {
                id: string
                config: any
                checksum: number
              }
            }[]
          }

          const configsMap = remoteFunctions.functions.reduce(
            (acc, config) => {
              if (config.current?.config?.name) {
                Object.assign(acc, {
                  [config.current.config.name]: config.current.checksum,
                })
              }

              return acc
            },
            {} as Record<string, number>,
          )

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
            let filesToUpload: Based.Deploy.FilesToUpload[] = []

            for (let [type, file] of updates) {
              deployType = type
              const found = await findConfigFile(
                file,
                mapping,
                nodeBundles,
                browserBundles,
              )

              if (found) {
                file = found.app || found.index || found.path

                if (!file) {
                  continue
                }

                if (found.type === 'schema') {
                  if (cluster !== 'baseddb') {
                    context.print
                      .intro(context.i18n('methods.schema.unavailable'))
                      .warning(context.i18n('methods.schema.setSchema'))
                      .line()
                  }
                  await schemaDeploy(context, found)

                  continue
                }

                if (!found.config.name) {
                  if (found.config.type === 'authorize') {
                    found.config.name = 'authorize'
                  } else {
                    continue
                  }
                }

                const assets = browserBundles.result.outputFiles
                const { outputs } = browserBundles.result.metafile

                filesToUpload = await prepareFilesToUpload(
                  assets,
                  favicons,
                  outputs,
                  publicPath,
                  assetsMap,
                )

                const checksumResult = configsChecksumCheck(
                  found,
                  nodeBundles,
                  browserBundles,
                  outputs,
                  forceReload,
                  assetsMap,
                  configsMap,
                )

                if (filesToUpload?.length && checksumResult?.length) {
                  await uploadFiles(context)(filesToUpload, publicPath)
                }

                const { deploys } = await configsDeploy(
                  context,
                  found,
                  checksumResult,
                  configsMap,
                )
                if (deploys?.length) {
                  deployed = true
                }
              }
            }

            if (deployType !== 'bundled') {
              if (deployed) {
                context.print.outro(
                  context.i18n('commands.deploy.methods.deployComplete'),
                )
              } else {
                context.print.outro('Nothing changed.')
              }
            }
          }
        } catch (error) {
          throw new Error(error)
        }
      }

      context.print.outro(
        context.i18n('commands.deploy.methods.deployComplete'),
      )

      if (watch) {
        context.print.line().step('<dim>Waiting for changes...</dim>')
      }

      if (!watch) {
        await basedClient.get('project').destroy()
        process.exit(0)
      }
    },
  )
}
