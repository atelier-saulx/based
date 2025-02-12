import type { BasedClient } from '@based/client'
import { BasedServer } from '@based/server'
import { contentType } from 'mime-types'

export const contextBasedServer = async (
  port: number,
  client: BasedClient,
  silent: boolean,
): Promise<BasedServer> => {
  const server = new BasedServer({
    silent,
    clients: {
      env: client,
    },
    port,
    functions: {
      configs: {
        files: {
          path: '/static/',
          type: 'function',
          // allow just http, without function
          fn: async () => {
            return
          },
          httpResponse: async (_based, _payload, responseData, send, ctx) => {
            console.log({ ctx })
            send(responseData, { contentType: 'flapdrol' })
          },
        },
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

  await server.start()

  return server
}
