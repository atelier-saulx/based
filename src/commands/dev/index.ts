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
import { invalidate, parseFunctions } from '../deploy/index.js'

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

class AppFile {
  constructor({
    outputFile,
    ip,
    port,
    folder = 'static',
  }: {
    outputFile: OutputFile
    ip: string
    port: number
    folder?: string
  }) {
    this.#outputFile = outputFile
    this.#folder = folder
    this.#ip = ip
    this.#port = port
  }

  #outputFile: OutputFile
  #folder: string
  #ip: string
  #port: number

  get text() {
    return this.#outputFile?.text || ''
  }

  get url() {
    return (
      this.#outputFile?.path.replace(
        process.cwd(),
        `http://${this.#ip}:${this.#port}/${this.#folder}`,
      ) || ''
    )
  }
}

const liveReloadScript = (port: number): string =>
  `<script>!function e(o){var n=window.location.hostname;o||(o=0),setTimeout((function(){var t=new WebSocket("ws://"+n+":${port}");t.addEventListener("message",(function(){location.reload()})),t.addEventListener("open",(function(){o>0&&location.reload(),console.log("%cBased live reload server connected","color: #bbb")})),t.addEventListener("close",(function(){console.log("%cBased live reload server reconnecting...","color: #bbb"),e(Math.min(o+1e3))}))}),o)}();</script>`

const basedOptsScript = (opts) => {
  return `<script>window.BASED=window.BASED||{};window.BASED.opts={${JSON.stringify(opts).replace(/":/g, ':').replace(/,"/g, ',').slice(2, -1)}}</script>`
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

  const { nodeBundles, browserBundles, configs } = await parseFunctions(
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
  let hadError: boolean

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

    if (
      err ||
      browserBundles?.error?.errors.length ||
      result?.error?.errors.length
    ) {
      const errors = result?.error?.errors || browserBundles?.error?.errors

      if (errors.length) {
        context.print
          .line()
          .intro(`<red>${context.i18n('methods.bundling.errorDetected')}</red>`)

        for (const error of errors) {
          if (error.location) {
            context.print
              .pipe()
              .log(`<b>${error.text}</b>`, context.state.emojis.error)

            if (error.location.lineText) {
              context.print.pipe().pipe(`"${error.location.lineText}"`).pipe()
            }

            context.print.log(
              context.i18n('methods.bundling.error.file', error.location.file),
              context.state.emojis.error,
            )

            if (error.location.line && error.location.column) {
              context.print.log(
                context.i18n(
                  'methods.bundling.error.location',
                  error.location.line,
                  error.location.column,
                ),
                context.state.emojis.error,
              )
            }

            if (error.pluginName) {
              context.print.log(
                context.i18n('methods.bundling.error.plugin', error.pluginName),
                context.state.emojis.error,
              )
            }
          }
        }
      }

      reloadClients = true
      hadError = true

      return
    }

    let fnUpdates: any
    hadError = false

    for (const { index, config, app, favicon } of configs) {
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

      if (result?.updates.length) {
        context.print
          .line()
          .intro(context.i18n('methods.bundling.changeDetected'))

        for (const [type, file] of result.updates) {
          context.print
            .pipe()
            .log(
              context.i18n(`methods.bundling.types.${type}`, file),
              '<secondary>◆</secondary>',
            )
        }
      }

      if (checksums[config.name] === checksum) {
        continue
      }

      checksums[config.name] = checksum

      if (await invalidate(context, index, config)) {
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
          html: new AppFile({ outputFile: appHtml, ip, port: devPort }),
          js: new AppFile({ outputFile: appJs, ip, port: devPort }),
          css: new AppFile({ outputFile: appCss, ip, port: devPort }),
          favicon: new AppFile({ outputFile: appFavicon, ip, port: devPort }),
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
              let str = `${liveReloadScript(lrPort)}<pre>`
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
            return `${html.substring(0, i)}${liveReloadScript(
              lrPort,
            )}${basedOptsScript(client.opts)}${html.substring(i)}`
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
