import { Command } from 'commander'
import { readdir, readFile } from 'node:fs/promises'
import { isAbsolute, join, relative } from 'node:path'
import { OutputFile, bundle } from '@based/bundle'
import { readJSON } from 'fs-extra/esm'
import { isIndexFile } from './utils.js'
import { getTargets } from './getTargets.js'
import { login } from '../../shared/login.js'
import { hash, hashCompact } from '@saulx/hash'
import { spinner } from '../../shared/spinner.js'
import { queued } from '@saulx/utils'
import { BasedClient } from '@based/client'
import mimeTypes from 'mime-types'
import pc from 'picocolors'
import ts from 'typescript'

const cwd = process.cwd()
const rel = (str: string) => relative(cwd, str)
const abs = (str: string, dir: string) =>
  isAbsolute(str) ? str : join(dir, str)

const invalidCode = async (fileName: string) => {
  const source = (await readFile(fileName)).toString()
  const target = ts.ScriptTarget.ESNext
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    target,
    false,
    ts.ScriptKind.TSX,
  )

  let hasExport

  ts.forEachChild(sourceFile, function walk(node) {
    if (
      node.kind === ts.SyntaxKind.ExportAssignment ||
      node.kind === ts.SyntaxKind.ExportKeyword
    ) {
      hasExport = true
    } else if (!hasExport) {
      ts.forEachChild(node, walk)
    }
  })

  if (!hasExport) {
    console.error(pc.red(`nothing exported in: ${fileName}`))
    return true
  }
}

const queuedFnDeploy = queued(
  async (
    client: BasedClient,
    checksum: number,
    config: any,
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
  },
  { dedup: ({ config }) => config, concurrency: 10 },
)

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
      const { targets, schema } = await getTargets()
      const configPaths = targets.map(([dir, file]) => join(dir, file))
      const includeSchema = schema && !functions
      let schemaPayload

      // bundle the configs and schema (if necessary)
      const configBundles = await bundle({
        entryPoints: includeSchema ? [schema, ...configPaths] : configPaths,
      })

      // read configs
      let configs: {
        config: {
          type: string
          name: string
          public?: boolean
          main?: string
          favicon?: string
          path?: string
          appParams?: {
            js?: string
            css?: string
            favicon?: string
          }
        }
        path: string
        dir: string
        index?: string
        app?: string
        favicon?: string
      }[] = await Promise.all(
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
        console.info(
          pc.yellow(`No ${functions ? 'matching ' : ''}function configs found`),
        )
        return
      }

      if (includeSchema) {
        const compiledSchema = configBundles.require(schema)
        schemaPayload = compiledSchema.default || compiledSchema
        if (!Array.isArray(schemaPayload)) {
          if (!schemaPayload.schema) {
            schemaPayload = { schema: schemaPayload }
          }
          schemaPayload = [schemaPayload]
        }
        console.info(
          `${pc.blue('schema')} ${schemaPayload.map(({ db = 'default' }) => db).join(', ')} ${pc.dim(rel(schema))}`,
        )
      }

      // log matching configs and find function indexes
      await Promise.all(
        configs.map(async (item) => {
          const { config, path } = item
          const access = config.public ? pc.cyan('public') + ' ' : ''
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
      const nodeEntryPoints = includeSchema ? [schema] : []
      const browserEntryPoints = []
      const favicons = new Set()

      const cancelled = await Promise.any(
        configs.map((configStore) => {
          const { config, path, index, dir } = configStore
          const existingPath = paths[config.name]
          if (existingPath) {
            console.info(pc.red(`found multiple configs for "${config.name}"`))
            return true
          }
          paths[config.name] = path
          if (!index) {
            console.info(
              pc.red(
                `could not find index.ts or index.js for "${config.name}"`,
              ),
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

            configStore.app = abs(config.main, dir)
            browserEntryPoints.push(configStore.app)

            if (config.favicon) {
              configStore.favicon = abs(config.favicon, dir)
              browserEntryPoints.push(configStore.favicon)
              favicons.add(rel(configStore.favicon))
            }
          }

          nodeEntryPoints.push(index)

          return invalidCode(index)
        }),
      )

      if (cancelled) {
        console.info(pc.yellow(`deploy cancelled`))
        return
      }

      const onWatch = (err) => {
        console.log('updates!', err)
        deployThings()
      }

      // build the functions
      const [nodeBundles, browserBundles] = await Promise.all([
        bundle(
          {
            entryPoints: nodeEntryPoints,
            sourcemap: 'external',
          },
          onWatch,
        ),
        bundle(
          {
            entryPoints: browserEntryPoints,
            sourcemap: 'external',
            platform: 'browser',
            define: {
              global: 'window',
              'process.env.NODE_ENV': '"production"',
            },
          },
          onWatch,
        ),
      ])

      const { client, destroy } = await login(program)

      const assetsMap: Record<string, string> = {}
      let previous = new Set<string | number>()

      async function deployThings() {
        const deployed: typeof previous = new Set()

        spinner.start()

        // update schema
        if (schemaPayload) {
          const { length } = schemaPayload
          const label = length === 1 ? 'schema' : `${length} schemas`
          const hashed = hash(schemaPayload)

          deployed.add(hashed)

          if (previous.has(hashed)) {
            console.log('schema did not change, skipping...')
          } else {
            spinner.text = `deploying ${label}`
            await client.call('db:set-schema', schemaPayload)
            spinner.succeed(`deployed ${label}`)
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
          .filter(({ ext, fileName }) => {
            if (ext === '.js') {
              if (favicons.has(outputs[fileName].entryPoint)) {
                // esbuild generates an stub js for the favicon, we don't need that
                return
              }
            }

            if (ext === '.map') {
              if (favicons.has(outputs[fileName.slice(0, -4)].entryPoint)) {
                // esbuild generates an stub js.map for the favicon, we don't need that
                return
              }
            }

            return true
          })

        if (uploads.length) {
          const label = 'uploading assets'
          let uploading = 0

          await Promise.all(
            uploads.map(async ({ path, contents, ext, fileName }) => {
              if (path in assetsMap) {
                console.log('already uploaded ' + fileName + ', skipping...')
                return
              }

              spinner.text = `${label} (${++uploading}/${uploads.length})`

              const id = `fi${hashCompact(fileName, 8)}`
              const { src: url } = await client.stream('db:file-upload', {
                contents,
                fileName,
                mimeType: mimeTypes.lookup(ext),
                payload: { id, $$fileKey: fileName },
              })

              assetsMap[path] = url
              assetsMap[fileName] = url
            }),
          )

          spinner.succeed(`uploaded ${uploading} assets`)
        }

        // deploy functions
        const label = 'deploying functions'
        let deploying = 0
        let url = client.connection?.ws.url
          .replace('ws://', 'http://')
          .replace('wss://', 'https://')

        url = url.substring(0, url.lastIndexOf('/'))

        await Promise.all(
          configs.map(async ({ index, app, favicon, config }) => {
            const js = nodeBundles.js(index)
            const sourcemap = nodeBundles.map(index)

            spinner.text = `${label} (${++deploying}/${configs.length})`

            if (app) {
              const appJS = browserBundles.js(app)
              const appCss = browserBundles.css(app)
              const appFavicon =
                favicon && outputs[browserBundles.find(favicon)]?.imports[0]
              config.appParams = {
                js: assetsMap[appJS?.path],
                css: assetsMap[appCss?.path],
                favicon: assetsMap[appFavicon?.path],
              }
            }

            const checksum = hash([js.hash, config])
            deployed.add(checksum)

            if (previous.has(checksum)) {
              console.log('already deployed ' + config.name + ', skipping...')
              return
            }

            await queuedFnDeploy(client, checksum, config, js, sourcemap)

            const { path = `/${config.name}`, public: isPublic } = config
            if (isPublic) {
              console.log(`🚀 ${pc.dim(url)}${path}`)
            }
          }),
        )

        spinner.succeed(`deployed ${deploying} functions`)
      }

      await deployThings()
      // destroy()
    },
  )
}
