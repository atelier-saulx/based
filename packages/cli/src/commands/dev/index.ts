import { join, relative } from 'node:path'
import { Readable } from 'node:stream'
import { buffer } from 'node:stream/consumers'
import type { BasedClient } from '@based/client'
import type {
  BasedAuthorizeFunctionConfig,
  BasedFunctionConfig,
} from '@based/functions'
import type { BasedServer } from '@based/server'
import { hash } from '@based/hash'
import type { Command } from 'commander'
import getPort from 'get-port'
import { WebSocket, WebSocketServer } from 'ws'
import { AppContext } from '../../context/index.js'
import { SharedBasedClient } from '../../shared/SharedBasedClient.js'
import {
  BASED_OPTS_SCRIPT,
  LIVE_RELOAD_SCRIPT,
} from '../../shared/constants.js'
import { getMyIp } from '../../shared/index.js'
import {
  findConfigFile,
  isConfigFile,
  isIndexFile,
  isInfraFile,
  isSchemaFile,
} from '../../shared/pathAndFiles.js'
import { configsBundle } from '../deploy/configsBundle.js'
import { configsParse } from '../deploy/configsParse.js'
import { filesBundle } from '../deploy/filesBundle.js'
import { getBasedFiles } from '../deploy/getBasedFiles.js'
import { configsInvalidateCode } from '../deploy/index.js'
// import { BundleFlow } from './BundleFlow.js'
import { FunctionFile } from './FunctionFile.js'
import { bundlingErrorHandling, bundlingUpdateHandling } from './handlers.js'
import type { BundleResult } from '../../bundle/BundleResult.js'
import type { BuildFailure, OutputFile } from 'esbuild'

export const dev = async (program: Command) => {
  const context: AppContext = AppContext.getInstance(program)
  const cmd: Command = context.commandMaker('dev')

  cmd.action(devServer)
}

export const devServer = async ({
  functions = [],
  port = '1234',
  cloud = false,
}: {
  functions?: string[]
  port?: string
  cloud?: boolean
}) => {
  const context: AppContext = AppContext.getInstance()
  await context.getProgram()

  const newPort =
    port && !Number.isNaN(Number.parseInt(port)) ? Number(port) : undefined

  const [devPort, liveReloadPort] = await Promise.all([
    getPort({ port: newPort }),
    getPort({ port: 4000 }),
  ])
  const ip = getMyIp()
  const wsURL = `ws://${ip}:${devPort}`
  const staticURL = `http://${ip}:${devPort}/static/`

  process.env.BASED_DEV_SERVER_LOCAL_URL = `http://localhost:${devPort}`
  process.env.BASED_DEV_SERVER_PUBLIC_URL = `http://${ip}:${devPort}`

  let client: BasedClient
  const returnedJobFunction = {}
  if (!cloud) {
    client = SharedBasedClient.getInstance({ url: wsURL })
  } else {
    client = (await context.getBasedClient()).get('project')
  }

  const { entryPoints, mapping } = await getBasedFiles(context)
  const bundledConfigs = await configsBundle(
    context,
    functions,
    entryPoints,
    mapping,
  )
  const { configs, node, browser, plugins } = await configsParse(
    context,
    bundledConfigs,
    entryPoints,
    mapping,
  )

  // const bundleFlow = new BundleFlow(configs, node, browser, plugins)
  // const bundled = await bundleFlow.bundle(
  //   'development',
  //   staticURL,
  //   wsURL,
  //   cloud,
  // )

  const { nodeBundles, browserBundles } = await filesBundle(
    context,
    node,
    browser,
    plugins,
    onChange,
    'development',
    staticURL,
    wsURL,
    cloud,
  )

  const { clients } = new WebSocketServer({ port: liveReloadPort })
  const basedServer: BasedServer = await context.basedServer(
    devPort,
    client,
    true,
    cloud,
  )

  for (const found of configs) {
    await onChange(null, {
      updates: [['bundled', found.path]],
    } as BundleResult)
  }

  context.print
    .intro('<primary><b>Based Dev Server</b></primary>')
    .step(`<dim><b>Local</b>: http://localhost:${devPort}</dim>`)
    .step(`<dim><b>Public</b>: http://${ip}:${devPort}</dim>`)
    .pipe()
    .step('<dim>Waiting for changes...</dim>')

  async function onChange(err: BuildFailure | null, result: BundleResult) {
    let specs: Based.Deploy.Specs
    let reloadClients: boolean = false

    if (
      err ||
      browserBundles.error?.errors.length ||
      result.error?.errors.length
    ) {
      const errors = result.error?.errors || browserBundles.error?.errors

      if (bundlingErrorHandling(context)(errors)) {
        reloadClients = true
        return
      }
    }

    const changedEntryPoints =
      result.changed
        ?.map(({ path }) => {
          const changedFile = relative(process.cwd(), path)
          const entryPoint =
            this.result.metafile.outputs[changedFile].entryPoint

          if (entryPoint) {
            return join(process.cwd(), entryPoint)
          }

          for (const file in this.result.metafile.outputs) {
            const output = this.result.metafile.outputs[file]

            if (output.cssBundle === changedFile) {
              return join(process.cwd(), output.entryPoint)
            }
          }

          return ''
        })
        .filter(Boolean) ||
      result.updates.map(([_type, file]) => file) ||
      []

    bundlingUpdateHandling(context)(result.updates)

    context.put('virtualFS', browserBundles.result.outputFiles)

    for (let file of changedEntryPoints) {
      const found = await findConfigFile(
        file,
        mapping,
        nodeBundles,
        browserBundles,
      )

      if (found) {
        if (isConfigFile(file) || isSchemaFile(file) || isInfraFile(file)) {
          file = found.path
        } else if (isIndexFile(file)) {
          file = found.index
        } else if (found.app) {
          file = found.app
        }

        if (!file) {
          continue
        }

        if (found.type === 'schema') {
          await basedServer.client.call('db:set-schema', found.config)
          continue
        }

        if (found.type === 'infra') {
          continue
        }

        const specsResult = await createSpecsFromConfigs(
          context,
          found,
          nodeBundles,
          browserBundles,
          ip,
          devPort,
          liveReloadPort,
          client,
        )

        if (
          specsResult?.specs !== undefined &&
          specsResult?.reloadClients !== undefined
        ) {
          specs = specsResult.specs
          reloadClients = specsResult.reloadClients
        }

        if (specs) {
          basedServer.functions.add(specs)

          for (const spec in specs) {
            if (
              (specs[spec].type as BasedAuthorizeFunctionConfig['type']) ===
              'authorize'
            ) {
              basedServer.auth.updateConfig({
                authorize: specs[spec].fn,
              })
            } else {
              basedServer.functions.update(spec, specs[spec].version)
            }

            if (specs[spec].type === 'job' && specs[spec].fn) {
              if (
                returnedJobFunction[specs[spec].name] &&
                typeof returnedJobFunction[specs[spec].name] === 'function'
              ) {
                returnedJobFunction[specs[spec].name]()
                returnedJobFunction[specs[spec].name] = null
              }

              returnedJobFunction[specs[spec].name] = specs[spec].fn(
                basedServer.client,
              )
            }
          }
        }

        if (reloadClients) {
          for (const client of clients) {
            if (client.readyState === WebSocket.OPEN) {
              client.send('')
            }
          }
        }
      }
    }
  }
}

function prepareAppFiles(
  file: string,
  favicon: string,
  browserBundles: BundleResult,
): Record<'html' | 'js' | 'css' | 'favicon', OutputFile> {
  const app = {} as Record<'html' | 'js' | 'css' | 'favicon', OutputFile>

  const faviconFile = browserBundles.find(favicon || '')
  const faviconPath =
    faviconFile &&
    favicon &&
    browserBundles.result.metafile.outputs[faviconFile]?.imports[0]?.path
  const faviconPathAbsolute = faviconPath && join(process.cwd(), faviconPath)

  if (file.endsWith('.html')) {
    app.html = browserBundles.html(file || '')
  } else {
    app.js = browserBundles.js(file || '')
    app.css = browserBundles.css(file || '')

    app.favicon =
      faviconPath &&
      browserBundles.result.outputFiles.find(
        ({ path }) => path === faviconPathAbsolute,
      )
  }

  return app
}

async function createSpecsFromConfigs(
  context: AppContext,
  found: Based.Deploy.Configs,
  nodeBundles: BundleResult,
  browserBundles: BundleResult,
  ip: string,
  devPort: number,
  liveReloadPort: number,
  client: BasedClient,
): Promise<{ specs: Based.Deploy.Specs; reloadClients: boolean }> {
  let checksum: number = 0
  const isApp = found.config.type === 'app' && found.app !== undefined
  const isAuthorize =
    (found.config.type as BasedAuthorizeFunctionConfig['type']) === 'authorize'
  const specs: Based.Deploy.Specs = {}
  let reloadClients: boolean = false

  let app: Record<'html' | 'js' | 'css' | 'favicon', OutputFile>

  if (isApp) {
    app = prepareAppFiles(found.app, found.favicon, browserBundles)
  }

  const js: OutputFile = nodeBundles.js(found.index || found.path)

  if (!js) {
    return undefined
  }

  const hashSeed = [js.hash, found.config]

  if (isApp) {
    hashSeed.push(
      app.html?.hash,
      app.html?.path,
      app.js?.hash,
      app.js?.path,
      app.css?.hash,
      app.css?.path,
      app.favicon?.path,
    )
  }

  checksum = hash(hashSeed.filter(Boolean))

  if (found.checksum === checksum) {
    return undefined
  }

  found.checksum = checksum

  await configsInvalidateCode(context, found)

  // if (!invalidate) {
  //   // ts validation
  //   specs[found.config.name] = {
  //     ...found.config,
  //     type: 'function',
  //     async fn() {
  //       return 'error (should log the ts error)'
  //     },
  //   }

  //   return { specs, reloadClients }
  // }

  const fn = nodeBundles.require(found.index || '')

  if (fn) {
    const defaultFn = fn.default || fn

    if (isApp) {
      const params = {
        html: new FunctionFile({
          outputFile: app.html,
          ip,
          port: devPort,
        }),
        js: new FunctionFile({ outputFile: app.js, ip, port: devPort }),
        css: new FunctionFile({
          outputFile: app.css,
          ip,
          port: devPort,
        }),
        favicon: new FunctionFile({
          outputFile: app.favicon,
          ip,
          port: devPort,
        }),
      }

      reloadClients = true

      if (found.config?.name) {
        specs[found.config.name] = {
          ...found.config,
          type: 'function',
          async fn(based, _payload, ctx) {
            const errorTarget =
              (browserBundles.error && browserBundles) ||
              (nodeBundles.error && nodeBundles)

            if (errorTarget) {
              const vsCodeLink = (str) =>
                `<a href='vscode://file${join(process.cwd(), str)}'>${str}</a>`
              let str = `${LIVE_RELOAD_SCRIPT(liveReloadPort)}<pre>`
              for (const { location, text } of errorTarget.error.errors) {
                if (location) {
                  const { file, column, line } = location
                  str += `\n${vsCodeLink(`${file}:${line}:${column}`)} ${text}`
                }
              }

              if (errorTarget.updates.length) {
                str += '\n'
                for (const [type, path] of errorTarget.updates) {
                  str += `\n${type}: ${vsCodeLink(path)}`
                }
              }

              str += '</pre>'
              return str
            }

            let html = await defaultFn(based, params, ctx)
            let i = -1

            if (html instanceof Readable) {
              html = (await buffer(html)).toString()
            }

            if (typeof html === 'string') {
              i = html.indexOf('</head>')

              if (i === -1) {
                i = html.indexOf('</body>')
              }

              if (i === -1) {
                i = html.indexOf('</html>')
              }
            }

            if (i === -1) {
              context.print.warning(
                'Invalid html, skip livereload tag and based opts tag',
              )
              return html
            }
            return `${html.substring(0, i)}${LIVE_RELOAD_SCRIPT(
              liveReloadPort,
            )}${BASED_OPTS_SCRIPT(client.opts)}${html.substring(i)}`
          },
        } as BasedFunctionConfig
      }
    } else if (isAuthorize) {
      specs[found.config?.name || 'authorize'] = {
        ...found.config,
        name: found.config.name || 'authorize',
        fn(...args) {
          return defaultFn(...args)
        },
      }
    } else {
      if (found.config?.name) {
        if (found.config.type === 'channel') {
          specs[found.config.name] = {
            ...found.config,
            publisher: defaultFn.publisher,
            subscriber: defaultFn.subscriber,
          }
        } else {
          specs[found.config.name] = {
            ...found.config,
            fn(...args) {
              return defaultFn(...args)
            },
          }
        }
      }
    }

    if (fn.httpResponse && found.config.name) {
      specs[found.config.name].httpResponse = fn.httpResponse
    }

    if (found.config.name) {
      specs[found.config.name].version = checksum
    }
  }

  return { specs, reloadClients }
}
