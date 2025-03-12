import { basename, extname } from 'node:path'
import { join } from 'node:path'
import type { OutputFile } from '@based/bundle'
import type { BasedClient } from '@based/client'
import type { BasedDb } from '@based/db'
import type { BasedFunctionConfigs } from '@based/functions'
import type { BasedServer } from '@based/server'
import type { AppContext } from '../context/index.js'
import { getContentType } from '../shared/index.js'

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

const localServerConfig: BasedFunctionConfigs = {
  'db:set-schema': {
    type: 'function',
    fn: async (based, schema) => {
      const db = based.db.v2 as BasedDb

      try {
        await db.putSchema(JSON.parse(JSON.stringify(schema)))
      } catch (error) {
        console.error(error)
      }
    },
  },
}

export const contextBasedServer =
  (context: AppContext) =>
  async (
    port: number,
    client: BasedClient,
    files: () => OutputFile[],
    silent: boolean,
    cloud: boolean,
  ): Promise<BasedServer> => {
    const { BasedServer } = await import('@based/server')
    const server = new BasedServer({
      silent,
      clients: {
        env: client,
      },
      port,
      functions: {
        configs: {
          static: {
            type: 'http',
            path: '/static/:file?',
            public: true,
            fn: async (_based, payload, send, _ctx) => {
              const getFileContent = (requestedFileName: string) =>
                files().find(
                  (file) => basename(file.path) === requestedFileName,
                )

              const file = payload.file
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
                    'Access-Control-Allow-Origin': '*',
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
          ...(cloud ? remoteServerConfig : localServerConfig),
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

    context.print.line().intro(context.i18n('methods.database.name')).pipe()

    if (!cloud) {
      try {
        const { BasedDb } = await import('@based/db')
        const basedDb = new BasedDb({
          path: join(process.cwd(), 'tmp'),
        })

        await basedDb.start({})

        server.client.db ??= {}
        server.client.db.v2 = basedDb

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

    server.on('error', (_message, data, _error) => {
      context.print
        .line()
        .error(context.i18n('methods.server.name'))
        .log(data, ' ')
    })
    await server.start()

    return server
  }
