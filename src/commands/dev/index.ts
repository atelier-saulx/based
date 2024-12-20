import { networkInterfaces } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { buffer } from 'node:stream/consumers'
import type { OutputFile } from '@based/bundle'
import { hash } from '@saulx/hash'
import type { Command } from 'commander'
import getPort from 'get-port'
import { WebSocket, WebSocketServer } from 'ws'
import { AppContext } from '../../shared/index.js'
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
  const cmd = program
    .command('dev')
    .option(
      '-f, --functions <functions...>',
      'The function names to be served (variadic).',
    )
    .option('--port <port>', 'To set manually the Based Dev Server port.')
    .option('--cloud', 'To connect to Based Cloud instead.')

  cmd.action(devServer)
}

class AppFile {
  constructor(outputFile: OutputFile, filePort: number) {
    this.#outputFile = outputFile
    this.#filePort = filePort
  }

  #outputFile: OutputFile
  #filePort: number

  get text() {
    return this.#outputFile?.text || ''
  }

  get url() {
    return (
      this.#outputFile?.path.replace(
        process.cwd(),
        `http://localhost:${this.#filePort}`,
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
}: { functions?: string[]; port?: string; cloud?: boolean }) => {
  process.on('SIGINT', () => {
    context.print.pipe().fail(context.i18n('methods.aborted'), true)
  })
  const context: AppContext = AppContext.getInstance()
  await context.getProgram()
  const basedClient = await context.getBasedClient()
  const newPort =
    port && !Number.isNaN(Number.parseInt(port)) ? Number(port) : undefined
  const { BasedServer } = await import('@based/server')
  const [devPort, filePort, _staticPort, lrPort] = await Promise.all([
    getPort({ port: newPort || 1234 }),
    getPort({ port: 2000 }),
    getPort({ port: 3000 }),
    getPort({ port: 4000 }),
  ])
  const ip = getOwnIp()
  const devServerWSPath = `ws://${ip}:${devPort}`
  const publicPath = `http://${ip}:${filePort}`
  // const staticPath = `http://${ip}:${staticPort}`
  context.print.info(
    `<primary><b>Based Dev Server:</b></primary> http://localhost:${devPort} | <dim>http://${ip}:${devPort}</dim>`,
    '<primary>▶</primary>',
  )
  context.print
    .info(
      `<primary><b>Based Bundle Server:</b></primary> http://localhost:${filePort} | <dim>http://${ip}:${filePort}</dim>`,
      '<primary>▶</primary>',
    )
    .line()
  console.log('cloud', cloud)
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

  const server = new BasedServer({
    silent: true,
    clients: {
      env: client,
    },
    port: devPort,
    functions: {
      configs: {
        db: {
          type: 'query',
          relay: { client: 'env' },
        },
        'db:schema': {
          type: 'query',
          relay: { client: 'env' },
        },
        'db:origins': {
          type: 'query',
          relay: { client: 'env' },
        },
        'db:set-schema': {
          type: 'function',
          relay: { client: 'env' },
        },
        'db:set': {
          type: 'function',
          relay: { client: 'env' },
        },
        'db:delete': {
          type: 'function',
          relay: { client: 'env' },
        },
        'db:get': {
          type: 'function',
          relay: { client: 'env' },
        },
        'db:events': {
          type: 'channel',
          relay: { client: 'env' },
        },
      },
    },
  })

  update(null)

  await server.start()
  await browserBundles.ctx.serve({ port: filePort })

  // const rewrites = []

  // for (const i in files) {
  //   rewrites.push({
  //     source: i,
  //     destination: files[i],
  //   })
  // }

  // http
  //   .createServer((request, response) => {
  //     return handler(request, response, {
  //       rewrites,
  //       headers: [
  //         {
  //           source: '*',

  //           headers: [
  //             {
  //               key: 'Access-Control-Allow-Origin',
  //               value: '*',
  //             },
  //           ],
  //         },
  //       ],
  //     })
  //   })
  //   .listen(staticPort, () => {
  //     console.info(
  //       `☁️  static server: http://localhost:${staticPort} ${pc.dim(`http://${ip}:${staticPort}`)}`,
  //     )
  //   })

  async function update(err) {
    let reloadClients = hadError

    if (err) {
      reloadClients = true
      hadError = true
    } else {
      // biome-ignore lint/suspicious/noExplicitAny: impossible to type now
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

        if (checksums[config.name] === checksum) {
          continue
        }

        checksums[config.name] = checksum

        if (await invalidate(context, index, config)) {
          // ts validation
          server.functions.add({
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
            html: new AppFile(appHtml, filePort),
            js: new AppFile(appJs, filePort),
            css: new AppFile(appCss, filePort),
            favicon: new AppFile(appFavicon, filePort),
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
                  '<yellow>invalid html, skip livereload tag and based opts tag</yellow>',
                  true,
                )
                return html
              }
              return `${html.substring(0, i)}${liveReloadScript(
                lrPort,
              )}${basedOptsScript(client.opts)}${html.substring(i)}`
            },
          }
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
        server.functions.add(fnUpdates)
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
