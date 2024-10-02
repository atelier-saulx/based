import { WebSocket, WebSocketServer } from 'ws'
import { buffer } from 'node:stream/consumers'
import {
  getMyIp,
  parseFunctions,
  invalidate,
  spinner,
  basedAuth,
  AppContext,
} from '../../shared/index.js'
import { OutputFile } from '@based/bundle'
import { Readable } from 'node:stream'
import { Command } from 'commander'
import { hash } from '@saulx/hash'
import getPort from 'get-port'
import { join } from 'path'
import pc from 'picocolors'
// import handler from 'serve-handler'
// import http from 'http'

export const dev = async (program: Command) => {
  const context: AppContext = AppContext.getInstance(program)
  const cmd = program
    .command('dev')
    .description('Develop your app running the Based Cloud locally.')
    .option('--port <port>', 'To set manually the Based Dev Server port.')
    .option(
      '-f, --function <functions...>',
      'The function names to be served (variadic).',
    )

  cmd.action(async ({ functions, port }) => {
    const { basedClient } = await basedAuth(context)

    const { BasedServer } = await import('@based/server')
    const ip: string = getMyIp()
    const [devPort, filePort, staticPort, lrPort] = await Promise.all([
      getPort({ port: port ?? 1234 }),
      getPort({ port: 2000 }),
      getPort({ port: 3000 }),
      getPort({ port: 4000 }),
    ])
    const publicPath: string = `http://${ip}:${filePort}`
    const staticPath: string = `http://${ip}:${staticPort}`

    spinner.succeed(
      `🚀 Dev server: http://localhost:${devPort} ${pc.dim(`http://${ip}:${devPort}`)}`,
    )
    spinner.succeed(
      `📦 Bundle server: http://localhost:${filePort} ${pc.dim(`http://${ip}:${filePort}`)} `,
    )

    const { clients } = new WebSocketServer({ port: lrPort })
    let hadError: boolean = false

    const server = new BasedServer({
      silent: true,
      clients: {
        env: basedClient,
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

    const { nodeBundles, browserBundles, configs } = await parseFunctions(
      context,
      functions,
      update,
      publicPath,
    )

    const checksums: Record<string, number> = {}
    await update(null)
    await server.start()
    await browserBundles.ctx.serve({ port: filePort })

    // const rewrites = []
    // for (const i in files) {
    //   rewrites.push({
    //     source: i,
    //     destination: files[i],
    //   })
    // }
    //
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

    async function update(err: null) {
      let reloadClients: boolean = hadError

      if (err) {
        reloadClients = true
        hadError = true
      } else {
        let fnUpdates: {} = {}
        hadError = false

        for (const { index, config, app, favicon } of configs) {
          const nodeJs: OutputFile = nodeBundles.js(index)
          let checksum: number
          let appHtml: OutputFile
          let appJs: OutputFile
          let appCss: OutputFile
          let appFavicon: OutputFile

          if (app) {
            const faviconPath =
              favicon &&
              browserBundles.result.metafile.outputs[
                browserBundles.find(favicon)
              ]?.imports[0]?.path
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
                nodeJs.hash,
                config,
              ].filter(Boolean),
            )
          } else {
            checksum = hash([nodeJs.hash, config])
          }

          if (checksums[config.name] === checksum) {
            continue
          }

          checksums[config.name] = checksum
          const ts = await invalidate(index, config)

          if (ts) {
            // ts validation
            server.functions.add({
              [config.name]: {
                type: 'function',
                async fn() {
                  return `<p>${ts}</p>`
                },
              },
            })
            continue
          }

          // const sourcemap = nodeBundles.map(index)
          const fn = nodeBundles.require(index)
          const defaultFn = fn[Object.keys(fn)[0]]
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
                  const vsCodeLink = (str: string) =>
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
                  console.warn(
                    '⚠️ Invalid html, skip livereload tag and based opts tag',
                  )
                  return html
                }

                return `${html.substring(0, i)}${liveReloadScript(
                  lrPort,
                )}${basedOptsScript(basedClient.opts)}${html.substring(i)}`
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
        clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send('')
          }
        })
      }
    }
  })
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

const basedOptsScript = (opts: unknown) => {
  return `<script>window.BASED=window.BASED||{};window.BASED.opts={${JSON.stringify(opts).replace(/":/g, ':').replace(/,"/g, ',').slice(2, -1)}}</script>`
}
