import { readdir } from 'node:fs/promises'
import { isAbsolute, join, relative } from 'node:path'
import {
  type BasedBundleOptions,
  type BuildFailure,
  type BundleResult,
  type Plugin,
  bundle,
} from '@based/bundle'
import { hash } from '@saulx/hash'
import type { Command } from 'commander'
import fg from 'fast-glob'
import { readJSON } from 'fs-extra/esm'
import { AppContext } from '../../context/index.js'
import { getTargets, isIndexFile } from '../../shared/index.js'
import {
  bundlingErrorHandling,
  bundlingUpdateHandling,
} from '../dev/handlers.js'
import { invalidateFunctionCode } from './invalidateFunctionCode.js'
import { prepareFilesToUpload, uploadFiles } from './peprareUpload.js'
import { prepareFilesToDeploy } from './prepareDeploy.js'
import { queuedFnDeploy } from './queues.js'
import { replaceBasedConfigPlugin } from './replaceBasedConfigPlugin.js'
export * from './invalidateFunctionCode.js'

const { glob } = fg
const cwd = process.cwd()
const rel = (str: string) => relative(cwd, str)
const abs = (str: string, dir: string) =>
  isAbsolute(str) ? str : join(dir, str)

export const parseFunctions = async (
  context: AppContext,
  functions: string[],
  onChange: (err: BuildFailure | null, res: BundleResult) => void,
  publicPath: string,
  staticPath: string,
  environment: 'development' | 'production',
  connectToCloud: boolean = false,
): Promise<Based.Deploy.ParsedFunction> => {
  const isProduction: boolean = environment === 'production'
  let { targets, schema: schemaPath } = await getTargets()
  const configPaths = targets.map(([dir, file]) => join(dir, file))
  const { display } = context.getGlobalOptions()

  if (functions) {
    schemaPath = null
  }

  context.print.intro('Loading your functions').pipe()

  let debug: boolean = false

  switch (display) {
    case 'silent':
    case 'log':
      debug = false
      break
    default:
      debug = true
  }

  // bundle the configs and schema (if necessary)
  const configBundles = await bundle({
    entryPoints: schemaPath ? [schemaPath, ...configPaths] : configPaths,
    debug,
  })

  // read configs
  let configs: Based.Deploy.Functions[] = await Promise.all(
    configPaths.map(async (path, index) => {
      const dir = targets[index][0]

      if (path.endsWith('.json')) {
        return { dir, path, config: await readJSON(path) }
      }

      const compiled = configBundles.require(path)

      return { dir, path, config: compiled.default || compiled }
    }),
  )

  if (functions) {
    // only include selected functions
    const filter = new Set(functions)
    configs = configs.filter(({ config }) => filter.has(config.name))
  }

  if (!configs.length) {
    const err = `No ${functions ? 'matching ' : ''}function configs found`
    context.print.warning(err)
    throw new Error(err)
  }

  // handle schema
  let schemaParsed: any
  if (schemaPath) {
    schemaParsed = parseSchema(configBundles, schemaPath)
    context.print.log(
      `<blueBright><b>[schema]</b></blueBright> ${schemaParsed.map(({ db = 'default' }) => db).join(', ')} <dim>${rel(schemaPath)}</dim>`,
      '<blueBright>◆</blueBright>',
    )
  }

  const functionsNameWidth = configs.reduce((acc, item) => {
    const name: string =
      item.config.type === ('authorize' as Based.Deploy.Function['type'])
        ? 'authorize'
        : item.config.name

    return name.length > acc ? name.length : acc
  }, 0)

  // log matching configs and find function indexes
  await Promise.all(
    configs.map(async (item) => {
      const { config, path } = item
      const accessLabel: string = config.public
        ? `<secondary>${'public'.padEnd(7)}</secondary>`
        : `<secondary>${'private'.padEnd(7)}</secondary>`
      const type: string = config.type || 'function'
      const name: string =
        config.type === 'authorize' ? 'authorize' : config.name
      const file: string = rel(path)
      const functionLabel: string = `<b>${name.padEnd(functionsNameWidth)}</b>`
      const typeLabel: string = `<dim><secondary>${type.padEnd(9)}</secondary></dim>`
      const pipe: string = '<dim>|</dim>'
      const fileLabel: string = `<dim>${file}</dim>`

      context.print.log(
        `${functionLabel} ${pipe} ${accessLabel} ${pipe} ${typeLabel} ${pipe} ${fileLabel}`,
        '<secondary>◆</secondary>',
      )

      const files = await readdir(item.dir)
      for (const file of files) {
        if (isIndexFile(file)) {
          item.index = join(item.dir, file)
          break
        }
      }
    }),
  )

  // validate and create bundle entryPoints
  const paths: Record<string, string> = {}
  const nodeEntryPoints: string[] = schemaPath ? [schemaPath] : []
  const functionsEntryPoints: string[] = []
  const browserEntryPoints: string[] = []
  const browserEsbuildPlugins: BasedBundleOptions['plugins'] = []
  const favicons = new Set<string>()
  const files: Record<string, string> = {}
  const invalids = await Promise.all(
    configs.map(async (configStore) => {
      const { config, path, index, dir } = configStore

      const existingPath = paths[config.name]
      if (existingPath) {
        context.print.warning(
          `<red>Found multiple configs for "${config.name}"</red>`,
        )

        return true
      }

      paths[config.name] = path

      if (!index) {
        context.print.warning(
          `<red>Could not find index.ts or index.js for "${config.name}"</red>`,
        )

        return true
      }

      if (config.type === 'app') {
        if (!config.main) {
          context.print.warning(
            `<red>No "main" field defined for "${config.name}" of type "app"</red>`,
          )

          return true
        }

        if (config?.plugins) {
          browserEsbuildPlugins.push(...(config.plugins as Plugin[]))
        }

        configStore.app = abs(config.main, dir)
        browserEntryPoints.push(configStore.app)

        if (config.favicon) {
          configStore.favicon = abs(config.favicon, dir)
          browserEntryPoints.push(configStore.favicon)
          favicons.add(rel(configStore.favicon))
        }
      }

      if (config.files) {
        const matched = await glob(config.files, { cwd: dir })
        const outsideRootFile = matched.find((file) => file.startsWith('../'))

        if (outsideRootFile) {
          context.print.warning(
            `<red>invalid "fields" defined for "${config.name}" - ${outsideRootFile} is not in ${dir}</red>`,
          )

          return true
        }

        if (!matched.length) {
          context.print.log(
            `<red>invalid "fields" defined for "${config.name}" - no files matched</red>`,
          )

          return true
        }

        for (const file of matched) {
          files[`${config.name}/${file}`] = file
        }
      }

      functionsEntryPoints.push(path)
      nodeEntryPoints.push(index)

      return invalidateFunctionCode(context, index, config, path)
    }),
  )

  const cancelled = invalids.find(Boolean)

  if (cancelled) {
    throw context.print.error(context.i18n('methods.aborted'))
  }

  context.print.line().intro(context.i18n('methods.bundling.project')).pipe()

  const introFunctions = async () =>
    context.print.log(
      context.i18n('methods.bundling.functionsLabel', nodeEntryPoints.length),
      '<secondary>◆</secondary>',
    )

  const introAssets = async () =>
    context.print
      .log(
        context.i18n('methods.bundling.assetsLabel', browserEntryPoints.length),
        '<secondary>◆</secondary>',
      )
      .log(
        context.i18n(
          'methods.bundling.pluginLabel',
          browserEsbuildPlugins.length,
        ),
        '<secondary>◆</secondary>',
      )

  // build the functions
  const [
    _logFunctions,
    _functionsWatcher,
    nodeBundles,
    _logAssets,
    browserBundles,
  ] = await Promise.all([
    await introFunctions(),
    await bundle(
      {
        entryPoints: functionsEntryPoints,
        sourcemap: false,
        bundle: true,
        minify: false,
        debug: false,
      },
      onChange,
    ),
    await bundle(
      {
        entryPoints: nodeEntryPoints,
        sourcemap: 'external',
        debug,
      },
      onChange,
    ),
    await introAssets(),
    await bundle(
      {
        debug,
        publicPath,
        entryPoints: browserEntryPoints,
        sourcemap: true,
        platform: 'browser',
        minify: isProduction,
        bundle: true,
        plugins: [
          replaceBasedConfigPlugin(context)({
            cloud: connectToCloud,
            url: staticPath,
          }),
          ...browserEsbuildPlugins,
        ],
        define: {
          global: 'window',
          'process.env.NODE_ENV': `"${environment}"`,
        },
      },
      onChange,
    ),
  ])

  return {
    schemaPath,
    schemaParsed,
    configs,
    favicons,
    nodeBundles,
    browserBundles,
    files,
  }
}

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

        // update schema
        if (schemaPath) {
          context.print
            .intro('<yellow>set-schema unavailable</yellow>')
            .warning(
              'db:set-schema is not currently available online. Please set schema manually',
            )
        }

        await update(null)
        if (!watch) {
          await basedClient.get('project').destroy()
        }

        // upload assets
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

        // const functions = nodeBundles.result.outputFiles
        const deploysNew = prepareFilesToDeploy(
          configs,
          nodeBundles,
          browserBundles,
          outputs,
          forceReload,
          assetsMap,
          functionsMap,
        )

        console.dir({ deploysNew }, { depth: null })

        // deploys
        const deploys = configs
          .map(({ index, app, favicon, config, path }) => {
            // console.log({ updates: result?.updates, path, dir, index })

            // path.relative(basePath, path.resolve(basePath, filePath))

            const js = nodeBundles.js(index)
            const sourcemap = nodeBundles.map(index)
            const appJs = app && browserBundles.js(app)
            let checksum: number

            if (app) {
              const appCss = browserBundles.css(app)
              const appFavicon =
                favicon && outputs[browserBundles.find(favicon)]?.imports[0]

              config.appParams = {
                js: assetsMap[appJs?.path],
                css: assetsMap[appCss?.path],
                favicon: assetsMap[appFavicon?.path],
              }

              const checksumSeed = [
                appJs?.hash,
                appCss?.hash,
                appFavicon?.path,
                js.hash,
                config,
              ]

              if (forceReload) {
                const num = Number(forceReload)
                const seconds = Number.isNaN(num) ? 10e3 : num * 1e3

                config.appParams.forceReload = Date.now() + seconds

                checksumSeed.push(Date.now())
              }

              checksum = hash(checksumSeed)
            } else {
              checksum = hash([js.hash, config])
            }

            return { checksum, config, js, sourcemap, path }
          })
          .filter(({ checksum }) => !previous.has(checksum))

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

function parseSchema(bundleResult: BundleResult, schema: string) {
  const compiledSchema = bundleResult.require(schema)
  let schemaPayload = compiledSchema.default || compiledSchema
  if (!Array.isArray(schemaPayload)) {
    if (!schemaPayload.schema) {
      schemaPayload = { schema: schemaPayload }
    }
    schemaPayload = [schemaPayload]
  }
  return schemaPayload
}
