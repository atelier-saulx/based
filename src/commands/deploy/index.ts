import { readFile, readdir } from 'node:fs/promises'
import { isAbsolute, join, relative } from 'node:path'
import { type BundleResult, type OutputFile, bundle } from '@based/bundle'
import type { BasedClient } from '@based/client'
import type { BasedFunctionConfig } from '@based/functions'
import { hash, hashCompact } from '@saulx/hash'
import { queued } from '@saulx/utils'
import type { Command } from 'commander'
import fg from 'fast-glob'
import { readJSON } from 'fs-extra/esm'
import mimeTypes from 'mime-types'
import pc from 'picocolors'
import ts from 'typescript'
import { AppContext, getTargets, isIndexFile } from '../../shared/index.js'

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
    console.warn(
      `${pc.yellow(
        `⚠️  missing type "${typeName}" in function "${config.name}" of type "${config.type}"`,
      )} ${pc.dim(rel(fileName))}`,
    )
    warned.add(fileName)
  }

  if (!hasExport) {
    console.error(pc.red(`nothing exported in: ${fileName}`))
    return true
  }
}

const queuedFileUpload = queued(
  // biome-ignore lint/suspicious/noExplicitAny: Impossible to type right now
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
          console.error(
            pc.red(`could not save sourcemap for: ${config.name}`),
            error.message,
          )
        })
    } else {
      console.error(pc.red('no dist id returned from set-function'))
    }

    return { distId }
  },
  { dedup: (_based, checksum) => checksum, concurrency: 10 },
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
  functions: string[],
  onChange,
  publicPath: string,
  staticPath: string,
) => {
  let { targets, schema } = await getTargets()
  const configPaths = targets.map(([dir, file]) => join(dir, file))

  if (!functions) {
    schema = null
  }

  // bundle the configs and schema (if necessary)
  const configBundles = await bundle({
    entryPoints: schema ? [schema, ...configPaths] : configPaths,
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
    console.info(pc.yellow(err))
    throw new Error(err)
  }

  // handle schema
  if (schema) {
    const schemaPayload = parseSchema(configBundles, schema)
    console.info(
      `${pc.blue('schema')} ${schemaPayload.map(({ db = 'default' }) => db).join(', ')} ${pc.dim(rel(schema))}`,
    )
  }

  // log matching configs and find function indexes
  await Promise.all(
    configs.map(async (item) => {
      const { config, path } = item
      const access = config.public ? `${pc.cyan('public')} ` : ''
      const type = pc.magenta(config.type || 'function')
      const name = config.name
      const file = pc.dim(rel(path))
      console.info(`${type} ${name} ${access}${file}`)

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
  const nodeEntryPoints: string[] = schema ? [schema] : []
  const browserEntryPoints: string[] = []
  const favicons = new Set<string>()
  const files: Record<string, string> = {}
  const invalids = await Promise.all(
    configs.map(async (configStore) => {
      const { config, path, index, dir } = configStore
      const existingPath = paths[config.name]
      if (existingPath) {
        console.info(pc.red(`found multiple configs for "${config.name}"`))
        return true
      }
      paths[config.name] = path
      if (!index) {
        console.info(
          pc.red(`could not find index.ts or index.js for "${config.name}"`),
        )
        return true
      }

      if (config.type === 'app') {
        if (!config.main) {
          console.info(
            pc.red(
              `no "main" field defined for "${config.name}" of type "app"`,
            ),
          )
          return true
        }

        // if (!('bundle' in config) || config.bundle) {
        configStore.app = abs(config.main, dir)
        browserEntryPoints.push(configStore.app)

        if (config.favicon) {
          configStore.favicon = abs(config.favicon, dir)
          browserEntryPoints.push(configStore.favicon)
          favicons.add(rel(configStore.favicon))
        }
        // }
      }

      if (config.files) {
        const matched = await glob(config.files, { cwd: dir })
        const outsideRootFile = matched.find((file) => file.startsWith('../'))

        if (outsideRootFile) {
          console.info(
            pc.red(
              `invalid "fields" defined for "${config.name}" - ${outsideRootFile} is not in ${dir}`,
            ),
          )
          return true
        }

        if (!matched.length) {
          console.info(
            pc.red(
              `invalid "fields" defined for "${config.name}" - no files matched`,
            ),
          )
          return true
        }

        for (const file of matched) {
          files[`${config.name}/${file}`] = file
        }
      }

      nodeEntryPoints.push(index)

      return invalidate(index, config)
    }),
  )

  const cancelled = invalids.find(Boolean)

  if (cancelled) {
    throw new Error('❌ deploy cancelled')
  }

  const replaceBasedConfigPlugin = (newConfig) => ({
    name: 'replace-based-config',
    setup(build) {
      build.onLoad({ filter: /based\.(js|ts|json)$/ }, async () => {
        return {
          contents: `export default ${JSON.stringify(newConfig)};`,
          loader: 'js',
        }
      })
    },
  })

  // build the functions
  const [nodeBundles, browserBundles] = await Promise.all([
    bundle(
      {
        entryPoints: nodeEntryPoints,
        sourcemap: 'external',
      },
      onChange,
    ),
    bundle(
      {
        publicPath,
        entryPoints: browserEntryPoints,
        sourcemap: true,
        platform: 'browser',
        bundle: true,
        ...(staticPath && {
          plugins: [
            replaceBasedConfigPlugin({
              url: staticPath,
            }),
          ],
        }),
        define: {
          global: 'window',
          'process.env.NODE_ENV': '"production"',
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
      process.on('SIGINT', () => process.exit(0))
      const context: AppContext = AppContext.getInstance(program)
      await context.getProgram()
      const basedClient = await context.getBasedClient()
      const { publicPath } = await basedClient
        .get('project')
        .call('based:env-info')
      const { nodeBundles, browserBundles, schema, favicons, configs } =
        await parseFunctions(functions, watch && update, publicPath, '')

      const assetsMap: Record<string, string> = {}
      let previous = new Set<string | number>()

      await update(null)
      if (!watch) {
        await basedClient.get('project').destroy()
      }

      async function update(err) {
        if (err) {
          console.error(err)
          return
        }

        const deployed: typeof previous = new Set()

        // update schema
        if (schema) {
          const schemaPayload = parseSchema(nodeBundles, schema)
          const hashed = hash(schemaPayload)

          deployed.add(hashed)

          if (!previous.has(hashed)) {
            context.spinner.start()
            const text = textFactory('deployed', 'schema', schemaPayload.length)
            context.spinner.start(text(0))
            await basedClient
              .get('project')
              .call('db:set-schema', schemaPayload)
            context.print.success(text())
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
          const text = textFactory('uploaded', 'asset', uploads.length)
          let uploading = 0

          context.spinner.start(text(0))

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
              context.print.info(text(++uploading))
              assetsMap[path] = destUrl
              assetsMap[fileName] = destUrl
            }),
          )

          context.print.success(text())
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
          const text = textFactory('deployed', 'function', deploys.length)
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
                basedClient.get('project'),
                checksum,
                config,
                js,
                sourcemap,
              )
              context.print.info(text(++deploying))
              const { path = `/${config.name}`, public: isPublic } = config
              if (isPublic) {
                return `🚀 ${pc.dim(url)}${path}`
              }
            }),
          )

          context.print.success(text())

          for (const log of logs) {
            if (log) {
              console.info(log)
            }
          }
        }

        previous = deployed
      }
    },
  )
}

function textFactory(prefix: string, suffix: string, total: number) {
  return (amount?: number) => {
    return `${prefix} ${amount === undefined ? total : `${amount}/${total}`} ${suffix}${total === 1 ? '' : 's'}`
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
