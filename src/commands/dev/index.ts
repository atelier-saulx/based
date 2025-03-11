import { networkInterfaces } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { buffer } from 'node:stream/consumers'
import type { BuildFailure, BundleResult, OutputFile } from '@based/bundle'
import type { BasedAuthorizeFunctionConfig } from '@based/functions'
import type { BasedServer } from '@based/server'
import { hash } from '@saulx/hash'
import type { Command } from 'commander'
import getPort from 'get-port'
import { WebSocket, WebSocketServer } from 'ws'
import { AppContext } from '../../context/index.js'
import {
  BASED_OPTS_SCRIPT,
  LIVE_RELOAD_SCRIPT,
} from '../../shared/constants.js'
import { invalidateFunctionCode } from '../deploy/index.js'
import { parseFunctions } from '../deploy/parseFunctions.js'
import { FunctionFile } from './FunctionFile.js'
import { bundlingErrorHandling, bundlingUpdateHandling } from './handlers.js'

const getOwnIp = () => {
  const nets = networkInterfaces()
  const results: Record<string, string[]> = {}

  for (const name in nets) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        results[name] ??= []
        results[name].push(net.address)
      }
    }
  }

  let ip = results.en0?.[0]

  if (!ip) {
    for (const k in results) {
      ip = results[k][0]
      if (ip) {
        return ip
      }
    }
  }

  return ip
}

export const dev = async (program: Command) => {
  const context: AppContext = AppContext.getInstance(program)
  const cmd: Command = context.commandMaker('dev')

  cmd.action(devServer)
}

export const devServer = async ({
  functions,
  port,
  cloud,
}: {
  functions?: string[]
  port?: string
  cloud?: boolean
}) => {
  const context: AppContext = AppContext.getInstance()
  await context.getProgram()
  const basedClient = await context.getBasedClient()
  const newPort =
    port && !Number.isNaN(Number.parseInt(port)) ? Number(port) : undefined

  const [devPort, lrPort] = await Promise.all([
    getPort({ port: newPort || 1234 }),
    getPort({ port: 4000 }),
  ])
  const ip = getOwnIp()
  const devServerWSPath = `ws://${ip}:${devPort}`
  const publicPath = `http://${ip}:${devPort}/static/`

  process.env.BASED_DEV_SERVER_LOCAL_URL = `http://localhost:${devPort}`
  process.env.BASED_DEV_SERVER_PUBLIC_URL = `http://${ip}:${devPort}`

  const { nodeBundles, browserBundles, configs, schemaParsed } =
    await parseFunctions(
      context,
      functions,
      update,
      publicPath,
      devServerWSPath,
      'development',
      cloud,
    )

  const client = basedClient.get('project')
  const checksums: Record<string, number> = {}
  const { clients } = new WebSocketServer({ port: lrPort })
  let hadError: boolean = true

  const basedServer: BasedServer = await context.basedServer(
    devPort,
    client,
    () => browserBundles.result.outputFiles,
    true,
    cloud,
  )

  update(null)

  const watching = update ? 'Waiting for changes...' : 'Not watching files'

  context.print
    .line()
    .intro('<primary><b>Based Dev Server</b></primary>')
    .pipe()
    .step(`<dim><b>Local</b>: http://localhost:${devPort}</dim>`)
    .step(`<dim><b>Public</b>: http://${ip}:${devPort}</dim>`)
    .pipe()
    .step(`<dim>${watching}</dim>`)

  async function update(err: BuildFailure | null, result?: BundleResult) {
    let reloadClients = hadError

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
        reloadClients = true
        hadError = true

        return
      }
    }

    let fnUpdates: any
    hadError = false

    for (const { index, config, app, favicon, path } of configs) {
      const js = nodeBundles.js(index)

      let checksum: number
      let appHtml: OutputFile
      let appJs: OutputFile
      let appCss: OutputFile
      let appFavicon: OutputFile

      if (app) {
        const faviconPath =
          favicon &&
          browserBundles.result.metafile.outputs[browserBundles.find(favicon)]
            ?.imports[0]?.path
        const faviconPathAbsolute =
          faviconPath && join(process.cwd(), faviconPath)

        if (app.endsWith('.html')) {
          appHtml = browserBundles.html(app)
        } else {
          appJs = browserBundles.js(app)
          appCss = browserBundles.css(app)
          appFavicon =
            faviconPath &&
            browserBundles.result.outputFiles.find(
              ({ path }) => path === faviconPathAbsolute,
            )
        }

        checksum = hash(
          [
            appHtml?.hash,
            appHtml?.path,
            appJs?.hash,
            appJs?.path,
            appCss?.hash,
            appCss?.path,
            appFavicon?.path,
            js.hash,
            config,
          ].filter(Boolean),
        )
      } else {
        checksum = hash([js.hash, config])
      }

      if (checksums[config.name] === checksum) {
        continue
      }

      checksums[config.name] = checksum

      if (await invalidateFunctionCode(context, index, config, path)) {
        // ts validation
        basedServer.functions.add({
          [config.name]: {
            type: 'function',
            async fn() {
              return 'error (should log the ts error)'
            },
          },
        })
        continue
      }

      // const sourcemap = nodeBundles.map(index)
      const fn = nodeBundles.require(index)
      const defaultFn = fn.default || fn
      fnUpdates ??= {}

      if (app) {
        const params = {
          html: new FunctionFile({ outputFile: appHtml, ip, port: devPort }),
          js: new FunctionFile({ outputFile: appJs, ip, port: devPort }),
          css: new FunctionFile({ outputFile: appCss, ip, port: devPort }),
          favicon: new FunctionFile({
            outputFile: appFavicon,
            ip,
            port: devPort,
          }),
        }

        reloadClients = true
        fnUpdates[config.name] = {
          ...config,
          type: 'function',
          async fn(based, _payload, ctx) {
            const errorTarget =
              (browserBundles.error && browserBundles) ||
              (nodeBundles.error && nodeBundles)

            if (errorTarget) {
              const vsCodeLink = (str) =>
                `<a href='vscode://file${join(process.cwd(), str)}'>${str}</a>`
              let str = `${LIVE_RELOAD_SCRIPT(lrPort)}<pre>`
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
              lrPort,
            )}${BASED_OPTS_SCRIPT(client.opts)}${html.substring(i)}`
          },
        }
      } else if (
        (config.type as BasedAuthorizeFunctionConfig['type']) === 'authorize'
      ) {
        fnUpdates[config.name || 'authorize'] = {
          ...config,
          name: config.name || 'authorize',
          fn(...args) {
            return defaultFn(...args)
          },
        }

        basedServer.auth.updateConfig({
          authorize: fnUpdates[config.name || 'authorize'].fn,
        })
      } else {
        fnUpdates[config.name] = {
          ...config,
          fn(...args) {
            return defaultFn(...args)
          },
        }
      }

      if (fn.httpResponse) {
        fnUpdates[config.name].httpResponse = fn.httpResponse
      }
    }

    if (schemaParsed) {
      context.spinner.start('Deploying schema')

      // TODO: once designed, we need to support multiple dbs and multiple schemas
      await basedServer.client.call('db:set-schema', schemaParsed[0].schema)

      context.print.success('Schema deployed')
    }

    if (fnUpdates) {
      basedServer.functions.add(fnUpdates)
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
