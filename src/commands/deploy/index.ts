import { readFile, readdir } from 'node:fs/promises'
import { isAbsolute, join, relative } from 'node:path'
import {
  type BasedBundleOptions,
  type BundleResult,
  type OutputFile,
  type Plugin,
  bundle,
} from '@based/bundle'
import type { BasedClient } from '@based/client'
import type { BasedFunctionConfig } from '@based/functions'
import { hash, hashCompact } from '@saulx/hash'
import { queued } from '@saulx/utils'
import type { Command } from 'commander'
import type { BuildFailure } from 'esbuild'
import fg from 'fast-glob'
import { readJSON } from 'fs-extra/esm'
import mimeTypes from 'mime-types'
import pc from 'picocolors'
import ts from 'typescript'
import { AppContext } from '../../context/index.js'
import { getTargets, isIndexFile } from '../../shared/index.js'

const { glob } = fg
const cwd = process.cwd()
const rel = (str: string) => relative(cwd, str)
const abs = (str: string, dir: string) =>
  isAbsolute(str) ? str : join(dir, str)

// const findType = (node: ts.Node, typeName: string) => {
//   // @ts-ignore
//   if (node.type?.typeName?.escapedText === typeName) {
//     return true
//   }

//   let found
//   ts.forEachChild(node, (node) => {
//     if (!found) {
//       found = findType(node, typeName)
//     }
//   })

//   return found
// }

const types = {
  query: 'BasedQueryFunction',
  function: 'BasedFunction',
  app: 'BasedAppFunction',
}

const warned = new Set()
export const invalidate = async (
  context: AppContext,
  fileName: string,
  config: Config,
): Promise<boolean> => {
  const source = (await readFile(fileName)).toString()
  const target = ts.ScriptTarget.ESNext
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    target,
    false,
    ts.ScriptKind.TSX,
  )
  const typeName = types[config.type]
  let hasExport: boolean
  let hasType = !typeName

  ts.forEachChild(sourceFile, function walk(node) {
    if (
      node.kind === ts.SyntaxKind.ExportAssignment ||
      node.kind === ts.SyntaxKind.ExportKeyword
    ) {
      hasExport = true
    }

    // @ts-ignore
    if (node.type?.typeName?.escapedText === typeName) {
      hasType = true
    }

    if (!hasType || !hasExport) {
      ts.forEachChild(node, walk)
    }
  })

  if (hasType) {
    warned.delete(fileName)
  } else if (!warned.has(fileName)) {
    context.print.warning(
      `<red>missing type "${typeName}" in function "${config.name}" of type "${config.type}"</red> <dim>${rel(fileName)}</dim>`,
      true,
    )

    warned.add(fileName)
  }

  if (!hasExport) {
    context.print.warning(`<red>nothing exported in: ${fileName}</red>`, true)
    return true
  }
}

const queuedFileUpload = queued(
  async (client: BasedClient, payload: any, destUrl: string) => {
    const { status } = await fetch(destUrl, { method: 'HEAD' })
    if (status === 200) {
      return { src: destUrl }
    }

    return client.stream('db:file-upload', payload)
  },
  { dedup: (_client, payload) => hash(payload), concurrency: 10 },
)

const queuedFnDeploy = queued(
  async (
    context: AppContext,
    client: BasedClient,
    checksum: number,
    config: Config,
    js: OutputFile,
    sourcemap: OutputFile,
  ) => {
    const { error, distId } = await client.stream('based:set-function', {
      contents: js.contents,
      payload: {
        checksum,
        config,
      },
    })

    if (error) {
      throw new Error(error)
    }

    if (distId) {
      await client
        .stream('based:set-sourcemap', {
          contents: sourcemap.contents,
          payload: {
            distId,
            checksum,
          },
        })
        .catch((error) => {
          context.print.warning(
            `<red>Could not save sourcemap for: ${config.name} ${error.message}</red>`,
            true,
          )
        })
    } else {
      context.print.warning(
        '<red>No dist id returned from set-function</red>',
        true,
      )
    }

    return { distId }
  },
  { dedup: (_context, _client, checksum) => hash(checksum), concurrency: 10 },
)

type Config = BasedFunctionConfig & {
  appParams?: {
    js?: string
    css?: string
    favicon?: string
  }
  files?: string[]
}

type ConfigStore = {
  config: Config
  path: string
  dir: string
  index?: string
  app?: string
  favicon?: string
}

export const parseFunctions = async (
  context: AppContext,
  functions: string[],
  onChange: (err: BuildFailure | null, res: BundleResult) => void,
  publicPath: string,
  staticPath: string,
  environment: 'development' | 'production',
  connectToCloud: boolean = false,
): Promise<{
  schema: string
  configs: ConfigStore[]
  favicons: Set<string>
  nodeBundles: BundleResult
  browserBundles: BundleResult
  files: Record<string, string>
}> => {
  const isProduction: boolean = environment === 'production'
  let { targets, schema } = await getTargets()
  const configPaths = targets.map(([dir, file]) => join(dir, file))
  const { display } = context.getGlobalOptions()

  if (!functions) {
    schema = null
  }

  context.print.intro('<b>Preparing your functions...</b>').pipe()

  let debug: boolean = false

  switch (display) {
    case 'silent':
    case 'info':
      debug = false
      break
    default:
      debug = true
  }

  // bundle the configs and schema (if necessary)
  const configBundles = await bundle({
    entryPoints: schema ? [schema, ...configPaths] : configPaths,
    debug,
  })

  // read configs
  let configs: ConfigStore[] = await Promise.all(
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
    context.print.warning(`<yellow>${err}</yellow>`, true)
    throw new Error(err)
  }

  // handle schema
  if (schema) {
    const schemaPayload = parseSchema(configBundles, schema)
    context.print.info(
      `<blueBright><b>[schema]</b></blueBright> ${schemaPayload.map(({ db = 'default' }) => db).join(', ')} <dim>${rel(schema)}</dim>`,
      '<blueBright>◆</blueBright>',
    )
  }

  const functionsNameWidth = configs.reduce((acc, item) => {
    const name: string =
      item.config.type === ('authorize' as Config['type'])
        ? 'authorize'
        : item.config.name

    return name.length > acc ? name.length : acc
  }, 0)

  // log matching configs and find function indexes
  await Promise.all(
    configs.map(async (item) => {
      const { config, path } = item
      const access = config.public
        ? `<secondary>${'public'.padEnd(7)}</secondary>`
        : `<secondary>${'private'.padEnd(7)}</secondary>`
      const type = config.type || 'function'
      const name =
        config.type === ('authorize' as Config['type'])
          ? 'authorize'
          : config.name
      const file = rel(path)
      context.print.info(
        `<secondary>${type.padEnd(9)}</secondary> <dim>|</dim> <b>${name.padEnd(functionsNameWidth)}</b> <dim>|</dim> ${access} <dim>${file}</dim>`,
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

  context.print.outro('<b>Functions ready!</b>')

  // validate and create bundle entryPoints
  const paths: Record<string, string> = {}
  const nodeEntryPoints: string[] = schema ? [schema] : []
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
          true,
        )

        return true
      }
      paths[config.name] = path
      if (!index) {
        context.print.warning(
          `<red>Could not find index.ts or index.js for "${config.name}"</red>`,
          true,
        )

        return true
      }

      if (config.type === 'app') {
        if (!config.main) {
          context.print.warning(
            `<red>No "main" field defined for "${config.name}" of type "app"</red>`,
            true,
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
            true,
          )

          return true
        }

        if (!matched.length) {
          context.print.info(
            `<red>invalid "fields" defined for "${config.name}" - no files matched</red>`,
            true,
          )

          return true
        }

        for (const file of matched) {
          files[`${config.name}/${file}`] = file
        }
      }

      nodeEntryPoints.push(index)

      return invalidate(context, index, config)
    }),
  )

  const cancelled = invalids.find(Boolean)

  if (cancelled) {
    throw context.print.fail(context.i18n('methods.aborted'), true)
  }

  const replaceBasedConfigPlugin = ({ cloud, url }): Plugin => ({
    name: 'replace-based-config',
    setup(build) {
      build.onResolve({ filter: /[\\\/]based\.(js|ts|json)$/ }, (args) => {
        return { path: args.path, namespace: 'replace-based' }
      })

      build.onLoad({ filter: /.*/, namespace: 'replace-based' }, async () => {
        if (cloud || !url) {
          await context.print
            .pipe()
            .info(
              '<b><blue>◉</blue>  Connecting your project to your cloud functions instead of the your local Based Dev Server.</b>',
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

        await context.print
          .pipe()
          .info(
            '<b><blue>◉</blue>  Connecting your project to your local functions instead of the cloud.</b>',
          )
          .pipe()

        return {
          contents,
          loader: 'js',
        }
      })
    },
  })

  const introFunctions = async () =>
    onChange
      ? context.print.intro('<dim>Bundling your functions...</dim>').pipe()
      : context.print.info(
          '<dim><blue>◉</blue>  Bundling your functions...</dim>',
        )

  const introAssets = async () =>
    onChange
      ? context.print.intro(
          '<dim>Bundling your assets and dependencies...</dim>',
        )
      : context.print.info(
          '<dim><blue>◉</blue>  Bundling your assets and dependencies...</dim>',
        )

  // build the functions
  const [_logFunctions, nodeBundles, _logAssets, browserBundles] =
    await Promise.all([
      await introFunctions(),
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
            ...browserEsbuildPlugins,
            replaceBasedConfigPlugin({
              cloud: connectToCloud,
              url: staticPath,
            }),
          ],
          define: {
            global: 'window',
            'process.env.NODE_ENV': `"${environment}"`,
          },
        },
        onChange,
      ),
    ])

  return { schema, configs, favicons, nodeBundles, browserBundles, files }
}

export const deploy = async (program: Command) => {
  const cmd = program
    .command('deploy')
    .option('-w, --watch', 'watch mode')
    .option(
      '-f, --functions <functions...>',
      'function names to deploy (variadic)',
    )

  cmd.action(
    async ({ functions, watch }: { functions: string[]; watch: boolean }) => {
      process.on('SIGINT', () => {
        context.print.pipe().fail(context.i18n('methods.aborted'))
      })
      const context: AppContext = AppContext.getInstance(program)
      await context.getProgram()
      const basedClient = await context.getBasedClient()
      const { publicPath } = await basedClient
        .get('project')
        .call('based:env-info')
      const { nodeBundles, browserBundles, schema, favicons, configs } =
        await parseFunctions(
          context,
          functions,
          watch && update,
          publicPath,
          '',
          'production',
        )

      const assetsMap: Record<string, string> = {}
      let previous = new Set<string | number>()

      await update(null)
      if (!watch) {
        await basedClient.get('project').destroy()
      }

      async function update(err) {
        if (err) {
          context.print.warning(`<red>${err}</red>`, true)
          return
        }

        const deployed: typeof previous = new Set()

        // update schema
        if (schema) {
          const schemaPayload = parseSchema(nodeBundles, schema)
          const hashed = hash(schemaPayload)

          deployed.add(hashed)

          if (!previous.has(hashed)) {
            const text = textFactory('deployed', 'schema', schemaPayload.length)

            context.spinner.start(text(0))

            await basedClient
              .get('project')
              .call('db:set-schema', schemaPayload)

            context.print.success(text(), true)
          }
        }

        // upload assets
        const assets = browserBundles.result.outputFiles
        const { outputs } = browserBundles.result.metafile
        const uploads = assets
          .map(({ path, contents }) => {
            const fileName = path.substring(path.lastIndexOf('/') + 1)
            const ext = fileName.substring(fileName.lastIndexOf('.'))
            return { path, contents, fileName, ext }
          })
          .filter(({ ext, path, fileName }) => {
            if (path in assetsMap) {
              return
            }

            if (ext === '.js') {
              if (favicons.has(outputs[fileName].entryPoint)) {
                // esbuild generates an stub js for the favicon, we don't need that
                return
              }
            } else if (ext === '.map') {
              if (favicons.has(outputs[fileName.slice(0, -4)].entryPoint)) {
                // esbuild generates an stub js.map for the favicon, we don't need that
                return
              }
            }

            return true
          })

        if (uploads.length) {
          const text = textFactory('Uploaded', 'asset', uploads.length)
          let uploading = 0

          context.spinner.start(text(0))
          context.print.line()

          await Promise.all(
            uploads.map(async ({ path, contents, ext, fileName }) => {
              const id = `fi${hashCompact(fileName, 8)}`
              const destUrl = `${publicPath}/${fileName}`
              await queuedFileUpload(
                basedClient.get('project'),
                {
                  contents,
                  fileName,
                  mimeType: mimeTypes.lookup(ext),
                  payload: { id, $$fileKey: fileName },
                },
                destUrl,
              )

              context.spinner.text(text(++uploading))

              assetsMap[path] = destUrl
              assetsMap[fileName] = destUrl
            }),
          )

          context.print.success(text(), true)
        }

        // deploys
        const deploys = configs
          .map(({ index, app, favicon, config }) => {
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

              checksum = hash([
                appJs?.hash,
                appCss?.hash,
                appFavicon?.path,
                js.hash,
                config,
              ])
            } else {
              checksum = hash([js.hash, config])
            }

            deployed.add(checksum)

            return { checksum, config, js, sourcemap }
          })
          .filter(({ checksum }) => !previous.has(checksum))

        if (deploys.length) {
          const text = textFactory('Deployed', 'function', deploys.length)
          // deploy functions
          let deploying = 0
          let url = basedClient
            .get('project')
            .connection?.ws.url.replace('ws://', 'http://')
            .replace('wss://', 'https://')

          url = url.substring(0, url.lastIndexOf('/'))

          context.spinner.start(text(0))

          const logs = await Promise.all(
            deploys.map(async ({ checksum, config, js, sourcemap }) => {
              await queuedFnDeploy(
                context,
                basedClient.get('project'),
                checksum,
                config,
                js,
                sourcemap,
              )

              context.spinner.text(text(++deploying))

              const { path = `/${config.name}`, public: isPublic } = config

              if (isPublic) {
                return `<dim>${url}</dim>${path}`
              }
            }),
          )

          if (logs.some(Boolean)) {
            context.print
              .success(text(), true)
              .line()
              .intro(
                `Your application is now ${pc.bold('LIVE')} at these URLs:`,
              )
              .pipe()

            for (const log of logs) {
              if (log) {
                context.print.info(log, true)
              }
            }

            context.print.outro('<b>The deployment is complete.</b>')
          } else {
            context.print
              .line()
              .success(text(), true)
              .outro('<b>The deployment is complete.</b>')
          }
        }

        previous = deployed
      }
      process.exit(0)
    },
  )
}

function textFactory(prefix: string, suffix: string, total: number) {
  return (amount?: number) => {
    return pc.bold(
      `${prefix} ${amount === undefined ? total : `${amount}/${total}`} ${suffix}${total === 1 ? '' : 's'}.`,
    )
  }
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
