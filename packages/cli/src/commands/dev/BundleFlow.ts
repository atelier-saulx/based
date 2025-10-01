// import { join } from 'node:path'
// import { Readable } from 'node:stream'
// import { buffer } from 'node:stream/consumers'
// import type {
//   BasedBundleOptions,
//   BuildFailure,
//   BundleResult,
//   OutputFile,
// } from '@based/bundle'
// import type { BasedClient } from '@based/client'
// import type { BasedAuthorizeFunctionConfig } from '@based/functions'
// import type { BasedServer } from '@based/server'
// import { hash } from '@based/hash'
// import { AppContext } from '../../context/index.js'
// import {
//   BASED_OPTS_SCRIPT,
//   LIVE_RELOAD_SCRIPT,
// } from '../../shared/constants.js'
// import { findConfigFile } from '../../shared/index.js'
// import { configsInvalidateCode } from '../deploy/configsInvalidateCode.js'
// import { filesBundle } from '../deploy/filesBundle.js'
// import { FunctionFile } from './FunctionFile.js'
// import { bundlingErrorHandling, bundlingUpdateHandling } from './handlers.js'

// export class BundleFlow {
//   #configs: Based.Deploy.Configs[]
//   #node: string[]
//   #browser: string[]
//   #plugins: BasedBundleOptions['plugins']
//   #context: AppContext = AppContext.getInstance()

//   public nodeBundles: BundleResult
//   public browserBundles: BundleResult

//   public constructor(
//     configs: Based.Deploy.Configs[],
//     node: string[],
//     browser: string[],
//     plugins: BasedBundleOptions['plugins'],
//   ) {
//     if (!configs.length || !node.length) {
//       throw new Error('Missing entrypoints')
//     }

//     this.#configs = configs
//     this.#node = node
//     this.#browser = browser
//     this.#plugins = plugins
//   }

//   public async bundle(
//     environment: 'development' | 'production' = 'development',
//     staticURL: string = '',
//     wsURL: string = '',
//     connectToCloud: boolean = false,
//   ): Promise<boolean> {
//     if (!staticURL) {
//       throw new Error('Missing static URL')
//     }

//     try {
//       const { nodeBundles, browserBundles } = await filesBundle(
//         this.#context,
//         this.#node,
//         this.#browser,
//         this.#plugins,
//         this.onChange,
//         environment,
//         staticURL,
//         wsURL,
//         connectToCloud,
//       )

//       this.nodeBundles = nodeBundles
//       this.browserBundles = browserBundles

//       return true
//     } catch (error) {
//       throw new Error(error)
//     }
//   }

//   public prepareAppFiles(
//     file: string,
//     favicon: string,
//     browserBundles: BundleResult,
//   ): Record<'html' | 'js' | 'css' | 'favicon', OutputFile> {
//     const app = {} as Record<'html' | 'js' | 'css' | 'favicon', OutputFile>

//     const faviconFile = browserBundles.find(favicon || '')
//     const faviconPath =
//       faviconFile &&
//       favicon &&
//       browserBundles.result.metafile.outputs[faviconFile]?.imports[0]?.path
//     const faviconPathAbsolute = faviconPath && join(process.cwd(), faviconPath)

//     if (file.endsWith('.html')) {
//       app.html = browserBundles.html(file || '')
//     } else {
//       app.js = browserBundles.js(file || '')
//       app.css = browserBundles.css(file || '')

//       app.favicon =
//         faviconPath &&
//         browserBundles.result.outputFiles.find(
//           ({ path }) => path === faviconPathAbsolute,
//         )
//     }

//     return app
//   }

//   public async createSpecsFromConfigs(
//     context: AppContext,
//     file: string,
//     found: Based.Deploy.Configs,
//     nodeBundles: BundleResult,
//     browserBundles: BundleResult,
//     ip: string,
//     devPort: number,
//     liveReloadPort: number,
//     client: BasedClient,
//     basedServer: BasedServer,
//   ): Promise<{ specs: Based.Deploy.Specs; reloadClients: boolean }> {
//     let checksum: number = 0
//     const isApp = found.config.type === 'app' && found.app !== undefined
//     const isAuthorize =
//       (found.config.type as BasedAuthorizeFunctionConfig['type']) ===
//       'authorize'
//     const isSchema = found.type === 'schema'
//     const specs: Based.Deploy.Specs = {}
//     let reloadClients: boolean = false

//     let app: Record<'html' | 'js' | 'css' | 'favicon', OutputFile>

//     if (isApp) {
//       app = this.prepareAppFiles(file, found.favicon, browserBundles)
//     }

//     const js = nodeBundles.js(found.index)

//     if (!js) {
//       return undefined
//     }

//     const hashSeed = [js.hash, found.bundled, found.mtimeMs, found.config]

//     if (isApp) {
//       hashSeed.push(
//         app.html?.hash,
//         app.html?.path,
//         app.js?.hash,
//         app.js?.path,
//         app.css?.hash,
//         app.css?.path,
//         app.favicon?.path,
//       )
//     }

//     checksum = hash(hashSeed.filter(Boolean))

//     if (found.checksum === checksum) {
//       return undefined
//     }

//     found.checksum = checksum

//     if (isSchema) {
//       await basedServer.client.call('db:set-schema', found.config)
//     }

//     await configsInvalidateCode(context, found)

//     // if (!invalidate) {
//     //   // ts validation
//     //   specs[found.config.name] = {
//     //     ...found.config,
//     //     type: 'function',
//     //     async fn() {
//     //       return 'error (should log the ts error)'
//     //     },
//     //   }

//     //   return { specs, reloadClients }
//     // }

//     const fn = nodeBundles.require(found.index || '')

//     if (fn) {
//       const defaultFn = fn.default || fn

//       if (isApp) {
//         const params = {
//           html: new FunctionFile({
//             outputFile: app.html,
//             ip,
//             port: devPort,
//           }),
//           js: new FunctionFile({ outputFile: app.js, ip, port: devPort }),
//           css: new FunctionFile({
//             outputFile: app.css,
//             ip,
//             port: devPort,
//           }),
//           favicon: new FunctionFile({
//             outputFile: app.favicon,
//             ip,
//             port: devPort,
//           }),
//         }

//         reloadClients = true
//         specs[found.config.name] = {
//           ...found.config,
//           type: 'function',
//           async fn(based, _payload, ctx) {
//             const errorTarget =
//               (browserBundles.error && browserBundles) ||
//               (nodeBundles.error && nodeBundles)

//             if (errorTarget) {
//               const vsCodeLink = (str) =>
//                 `<a href='vscode://file${join(process.cwd(), str)}'>${str}</a>`
//               let str = `${LIVE_RELOAD_SCRIPT(liveReloadPort)}<pre>`
//               for (const { location, text } of errorTarget.error.errors) {
//                 if (location) {
//                   const { file, column, line } = location
//                   str += `\n${vsCodeLink(`${file}:${line}:${column}`)} ${text}`
//                 }
//               }

//               if (errorTarget.updates.length) {
//                 str += '\n'
//                 for (const [type, path] of errorTarget.updates) {
//                   str += `\n${type}: ${vsCodeLink(path)}`
//                 }
//               }

//               str += '</pre>'
//               return str
//             }

//             let html = await defaultFn(based, params, ctx)
//             let i = -1

//             if (html instanceof Readable) {
//               html = (await buffer(html)).toString()
//             }

//             if (typeof html === 'string') {
//               i = html.indexOf('</head>')

//               if (i === -1) {
//                 i = html.indexOf('</body>')
//               }

//               if (i === -1) {
//                 i = html.indexOf('</html>')
//               }
//             }

//             if (i === -1) {
//               context.print.warning(
//                 'Invalid html, skip livereload tag and based opts tag',
//               )
//               return html
//             }
//             return `${html.substring(0, i)}${LIVE_RELOAD_SCRIPT(
//               liveReloadPort,
//             )}${BASED_OPTS_SCRIPT(client.opts)}${html.substring(i)}`
//           },
//         }
//       } else if (isAuthorize) {
//         specs[found.config.name || 'authorize'] = {
//           ...found.config,
//           name: found.config.name || 'authorize',
//           fn(...args) {
//             return defaultFn(...args)
//           },
//         }
//       } else {
//         if (found.config.name) {
//           specs[found.config.name] = {
//             ...found.config,
//             fn(...args) {
//               return defaultFn(...args)
//             },
//           }
//         }
//       }

//       if (fn.httpResponse && found.config.name) {
//         specs[found.config.name].httpResponse = fn.httpResponse
//       }
//     }

//     return { specs, reloadClients }
//   }

//   public async onChange(err: BuildFailure | null, result?: BundleResult) {
//     const updates = result?.updates
//     let specs: Based.Deploy.Specs
//     let reloadClients: boolean = false

//     if (
//       err ||
//       this.browserBundles?.error?.errors.length ||
//       result?.error?.errors.length
//     ) {
//       const errors = result?.error?.errors || this.browserBundles?.error?.errors

//       if (bundlingErrorHandling(this.#context)(errors)) {
//         reloadClients = true

//         return
//       }
//     }

//     if (updates?.length) {
//       bundlingUpdateHandling(this.#context)(updates)

//       for (let [_type, file] of updates) {
//         const found = await findConfigFile(file, mapping, this.nodeBundles)

//         if (found) {
//           if (found?.app) {
//             file = found.app
//           } else if (found?.index) {
//             file = found.index
//           } else {
//             continue
//           }

//           const specsResult = await this.createSpecsFromConfigs(
//             this.#context,
//             file,
//             found,
//             this.nodeBundles,
//             this.browserBundles,
//             ip,
//             devPort,
//             liveReloadPort,
//             client,
//             basedServer,
//           )

//           if (
//             specsResult?.specs !== undefined &&
//             specsResult?.reloadClients !== undefined
//           ) {
//             specs = specsResult.specs
//             reloadClients = specsResult.reloadClients
//           }

//           if (specs) {
//             for (const spec in specs) {
//               if (
//                 (specs[spec].type as BasedAuthorizeFunctionConfig['type']) ===
//                 'authorize'
//               ) {
//                 basedServer.auth.updateConfig({
//                   authorize: specs[spec].fn,
//                 })
//               }
//             }

//             if (!found.serverFunction) {
//               found.serverFunction = found.config.name
//             } else {
//               await basedServer.functions.removeRoute(found.serverFunction)
//               found.serverFunction = found.config.name
//             }

//             basedServer.functions.add(specs)
//           }

//           if (reloadClients) {
//             for (const client of clients) {
//               if (client.readyState === WebSocket.OPEN) {
//                 client.send('')
//               }
//             }
//           }
//         }
//       }
//     }
//   }
// }
