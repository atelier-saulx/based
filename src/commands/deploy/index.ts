import type { OutputFile } from '@based/bundle'
import { hash, hashCompact } from '@saulx/hash'
import { queued } from '@saulx/utils'
import type { Command } from 'commander'
import mimeTypes from 'mime-types'
import pc from 'picocolors'
import { AppContext, parseFunctions, parseSchema } from '../../shared/index.js'
import { spinner } from '../../shared/spinner.js'
// import ts from 'typescript'

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

const queuedFileUpload = queued(
  async (
    context: AppContext,
    basedClient: Based.API.Client,
    payload,
    destUrl: string,
  ) => {
    const { status } = await fetch(destUrl, { method: 'HEAD' })
    if (status === 200) {
      return { src: destUrl }
    }
    return basedClient.call(context.endpoints.DEPLOY_FILE_UPLOAD, payload)
  },
  { dedup: (_client, payload) => hash(payload), concurrency: 10 },
)

const _queuedFnDeploy = queued(
  async (
    context: AppContext,
    basedClient: Based.API.Client,
    checksum: number,
    config,
    js: OutputFile,
    sourcemap: OutputFile,
  ) => {
    const { error, distId } = await basedClient.call(
      context.endpoints.DEPLOY_SET_FUNCTION,
      {
        contents: js.contents,
        payload: {
          checksum,
          config,
        },
      },
    )

    if (error) {
      throw new Error(error)
    }

    if (distId) {
      try {
        await basedClient.call(context.endpoints.DEPLOY_SET_SOURCEMAP, {
          contents: sourcemap.contents,
          payload: {
            distId,
            checksum,
          },
        })
      } catch (error) {
        console.error(
          pc.red(`could not save sourcemap for: ${config.name}`),
          error.message,
        )
      }
    } else {
      console.error(pc.red('no dist id returned from set-function'))
    }

    return { distId }
  },
  { dedup: (_based, checksum) => checksum, concurrency: 10 },
)

export const deploy = async (program: Command) => {
  const context: AppContext = AppContext.getInstance(program)
  const cmd: Command = context.commandMaker('deploy')

  cmd.action(
    async ({ functions, watch }: { functions: string[]; watch: boolean }) => {
      const basedClient = await context.getBasedClient()
      const { publicPath } = await basedClient.call(context.endpoints.ENV_INFO)
      const { nodeBundles, browserBundles, schema, favicons, configs } =
        await parseFunctions(context, functions, watch && update, publicPath)

      const assetsMap: Record<string, string> = {}
      let previous = new Set<string | number>()

      await update(null)

      if (!watch) {
        basedClient.destroy()
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
            spinner.start()
            const text = textFactory('deployed', 'schema', schemaPayload.length)
            spinner.start(text(0))
            await basedClient.call(
              context.endpoints.DEPLOY_SET_SCHEMA,
              schemaPayload,
            )
            spinner.succeed(text())
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

          spinner.start(text(0))

          await Promise.all(
            uploads.map(async ({ path, contents, ext, fileName }) => {
              const id = `fi${hashCompact(fileName, 8)}`
              const destUrl = `${publicPath}/${fileName}`
              await queuedFileUpload(
                context,
                basedClient,
                {
                  contents,
                  fileName,
                  mimeType: mimeTypes.lookup(ext),
                  payload: { id, $$fileKey: fileName },
                },
                destUrl,
              )
              spinner.text = text(++uploading)
              assetsMap[path] = destUrl
              assetsMap[fileName] = destUrl
            }),
          )

          spinner.succeed(text())
        }

        // deploys
        const deploys = configs
          .map(({ index, app, favicon, config }) => {
            const js: OutputFile = nodeBundles.js(index)
            const sourcemap: OutputFile = nodeBundles.map(index)
            const appJs: OutputFile = app && browserBundles.js(app)
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

          spinner.start(text(0))

          const logs = await Promise.all(
            deploys.map(async ({ checksum, config, js, sourcemap }) => {
              await _queuedFnDeploy(
                context,
                basedClient,
                checksum,
                config,
                js,
                sourcemap,
              ),
                (spinner.text = text(++deploying))

              const { path = `/${config.name}`, public: isPublic } = config

              if (isPublic) {
                return `🚀 ${pc.dim(url)}${path}`
              }
            }),
          )

          spinner.succeed(text())

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
