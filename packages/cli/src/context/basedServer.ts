import { basename, extname } from 'node:path'
import { join } from 'node:path'
import type { Readable } from 'node:stream'
import type { BasedClient } from '@based/client'
import type { BasedDb } from '@based/db'
import type {
  BasedFunctionConfigs,
  ObservableUpdateFunction,
} from '@based/functions'
import type { BasedServer } from '@based/server'
import { hash } from '@based/hash'
import { v4 as uuid } from 'uuid'
import { getContentType, getMyIp, streamToUint8Array } from '../shared/index.js'
import type { AppContext } from './AppContext.js'
import { deepMerge } from '@based/utils'
import { createRequire } from 'module'
global.require = createRequire(import.meta.url)
import { authEmail } from './authEmail/index.js'

const remoteServerConfig: BasedFunctionConfigs = {
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
}

const localServerConfig = (context: AppContext): BasedFunctionConfigs => ({
  'db:set-schema': {
    type: 'function',
    fn: async (based, schema) => {
      
      // @ts-ignore
      const db = based.db.v2 as BasedDb
      if (!Array.isArray(schema)) {
        schema = [schema.schema ? schema : { schema }]
      }
      if (schema.length > 1) {
        console.info('Multiple schemas found: merging for local dev')
      }
      const mergedSchema = {}
      for (const { schema: schemaItem } of schema) {
        deepMerge(mergedSchema, schemaItem)
      }

      try {
        await db.setSchema(mergedSchema)
      } catch (error) {
        context.print
          .line()
          .error(context.i18n('methods.server.name'))
          .log('<b>db:set-schema</b>', null)
          .log(`<red>${error.message.trim()}</red>`, null)
          .line()
      }
    },
  },
  'db:file-upload': {
    type: 'stream',
    maxPayloadSize: -1,
    async fn(
      based,
      { mimeType, size, stream, fileName, extension, payload = {} },
    ) {
      async function addVirtualFile(virtualPath: string, stream: Readable) {
        try {
          const fileBuffer = await streamToUint8Array(stream)

          context.put('virtualFS', [
            {
              path: virtualPath,
              contents: fileBuffer,
              hash: hash(fileBuffer.length),
              text: '',
            },
          ])
        } catch (error) {
          throw new Error('Was not possible to read the file', error)
        }
      }

      if (!extension && fileName) {
        extension = fileName.split('.').splice(1).join('.')
      }

      if (!payload || typeof payload !== 'object') {
        payload = {}
      }

      const id = payload?.id || Date.now()
      payload.name ??= fileName

      // this $$fileKey is a hack because `fileName` is bugged when using node
      const Key =
        payload.$$fileKey ?? `${id}/${uuid()}-${uuid()}-${uuid()}.${extension}`
      const Bucket = Date.now()

      delete payload.$$fileKey

      const ip = getMyIp()
      const port = based.server.port
      const src = `http://${ip}:${port}/static/${Bucket}/${Key}`
      // @ts-ignore
      const db = based.db.v2 as BasedDb

      const basedDbId = await db.create('file', {
        name: fileName,
        size,
        progress: 0,
        status: 'uploading',
        statusText: 'uploading',
        mimeType,
        src,
        ...payload,
      })

      stream.on('progress', async (data) => {
        await db.update('file', basedDbId, {
          progress: data,
          statusText: 'uploading',
          status: 'uploading',
        })
      })

      stream.on('error', async () => {
        await db.update('file', basedDbId, {
          statusText: 'error',
          status: 'error',
        })
      })

      stream.on('end', async () => {
        // if (mimeType.startsWith('video/')) {
        //   await db.update('file', basedDbId, {
        //     statusText: 'transcoding',
        //     status: 'transcoding',
        //   })
        // } else {
        await db.update('file', basedDbId, {
          statusText: 'ready',
          status: 'ready',
        })
        // }
      })

      await addVirtualFile(`${Bucket}/${Key}`, stream)

      return { id, src }
    },
  },
})

export const contextBasedServer =
  (context: AppContext) =>
  async (
    port: number,
    client: BasedClient,
    silent: boolean,
    cloud: boolean,
  ): Promise<BasedServer> => {
    const { BasedServer } = await import('@based/server')
    const connectedListeners = new Set<ObservableUpdateFunction<number>>()
    let connected = 0
    const server = new BasedServer({
      silent,
      clients: {
        env: client,
      },
      port,
      rateLimit: {
        drain: 1e6,
        ws: 1e6,
        http: 1e6,
      },
      ws: {
        open() {
          connected++
          for (const update of connectedListeners) {
            update(connected)
          }
        },
        close() {
          connected--
          for (const update of connectedListeners) {
            update(connected)
          }
        },
      },
      functions: {
        configs: {
          'based:connections': {
            type: 'query',
            fn: async (_based, _payload, update) => {
              update(connected)
              connectedListeners.add(update)
              return () => {
                connectedListeners.delete(update)
              }
            },
          },
          'based:auth-email': {
            type: 'function',
            internalOnly: true,
            fn: authEmail,
          },
          static: {
            type: 'http',
            path: '/static/:file*',
            public: true,
            fn: async (_based, payload, send, _ctx) => {
              const getFileContent = (requestedFileName: string) =>
                context
                  .get('virtualFS')
                  .find(
                    (file: Based.Context.VirtualFS) =>
                      basename(file.path) === requestedFileName ||
                      file.path === requestedFileName,
                  )

              const file = payload.file.join('/')
              const urlPath = file ? file : '/'
              const requestedFileName = urlPath === '/' ? 'index.html' : urlPath
              const fileContent = getFileContent(requestedFileName)

              if (!fileContent) {
                send(
                  'File Not Allowed or Not Found',
                  { 'Content-Type': 'text/plain' },
                  404,
                )
                return
              }

              try {
                const dataBuffer = Buffer.from(fileContent.contents)
                const ext = extname(fileContent.path).toLowerCase()
                const contentType = getContentType(ext)
                let contentData: string | Buffer<ArrayBuffer> = dataBuffer

                if (
                  contentType.includes('text') ||
                  contentType.includes('javascript')
                ) {
                  contentData = dataBuffer.toString('utf8')
                }

                send(
                  contentData,
                  {
                    'Content-Type': contentType,
                  },
                  200,
                )
              } catch {
                send(
                  'Internal Server Error',
                  { 'Content-Type': 'text/plain' },
                  500,
                )
              }
            },
          },
          ...(cloud ? remoteServerConfig : localServerConfig(context)),
        },
      },
      auth: {
        verifyAuthState: async (_, ctx, authState) => {
          if (authState.token !== ctx.session?.authState.token) {
            return { ...authState }
          }

          return true
        },
      },
    })

    context.print.intro(context.i18n('methods.database.name'))

    if (!cloud) {
      try {
        const allDb = await import('@based/db')
        global.__DB__ = allDb
        const { BasedDb } = allDb
        const basedDb = new BasedDb({
          path: join(process.cwd(), 'tmp'),
          saveIntervalInSeconds: 5,
        })

        await basedDb.start({})
        const dbServerClient = {
          channel(...args) {
            console.warn('dbServerClient channel not implemented', ...args)
          },
          call(...args) {
            console.warn('dbServerClient call not implemented', ...args)
          },
          query(...args) {
            console.warn('dbServerClient query not implemented', ...args)
          },
        }


        server.client.db = basedDb.client

        Object.defineProperty(basedDb.client, 'v2', {
          get() {
            console.warn(
              '[warning] based.db.v2 is deprecated and will be removed soon, use based.db instead',
            )
            return basedDb.client
          },
        })

        // @ts-ignore
        server.client.db.getDbClient = (name: string) => {
          return { dbClient: basedDb.client, dbServerClient }
        }

        context.print.step(
          context.i18n(
            'methods.database.instance',
            context.i18n('methods.database.running'),
          ),
        )
      } catch (error) {
        context.print.error(context.i18n('methods.database.instance', error))
      }
    } else {
      context.print.step(
        context.i18n(
          'methods.database.instance',
          context.i18n('methods.database.notRunning'),
        ),
      )
    }

    server.on('error', (_message, data, error) => {
      console.dir({ data, error }, { depth: null })
      if (data) {
        context.print
          .line()
          .error(context.i18n('methods.server.name'))
          .log(`<red>${JSON.stringify(data, null, 2)}</red>`, null)
          .log(error?.toString(), null)
          .line()
      }
    })
    await server.start()

    if (!cloud) {
      await client.once('connect')
    }

    return server
  }
