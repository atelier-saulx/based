import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import { wait } from '@saulx/utils'
import getPort from 'get-port'
import { createInlineFromCurrentCache, createInlineCache } from '../src/ssr.js'
import connect from '../src/websocket/index.js'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('proxy', async (t: T) => {
  const client = new BasedClient()

  const server = new BasedServer({
    port: t.context.port,
    rateLimit: { ws: 1e9, http: 1e9, drain: 1e3 },
    functions: {
      configs: {
        counter: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          fn: (_, __, update) => {
            const x: string[] = []
            for (let i = 0; i < 3; i++) {
              x.push('flap ' + i)
            }
            update(x)
            return () => {}
          },
        },
      },
    },
  })

  const proxyServer = new BasedServer({
    port: t.context.port,
    rateLimit: { ws: 1e9, http: 1e9, drain: 1e3 },
    functions: {
      configs: {
        admin: {
          path: '',
          type: 'proxy',
          protocol: 'based'
        },
        imdb: {
          // path: 'im',
          type: 'proxy',
          // preset: 'based' / 'http' / 'tcp'
          protocol: 'http'
          query: {
            url: 'http://imdb.com/api/v3/*',
            method: 'post',
            headers: {
              token: 'api-token-123'
            },
            poll: 1000,
          }
        },
        raw: {
          type: 'proxy',
          function: () => {
            throw new Error('no fn')
          },
          query: (path, based, payload, update, error) => {
            // path
            const get = () => {
              fetch('http://google.com')
                .text()
                .then((r) => {
                  update(r)
                })
            }
            const interval = setInterval(get, 1000)
            return () => {
              clearInterval(interval)
            }
          },
        }
      },
    },
  })

  // http://www.omdbapi.com/?t=bla

  client.query('imdb.movies/latest', { page: 2, search: 'matrix' }).subscribe(() => {
    // hello
  })



  await server.start()

  client.connect({
    url: async () => {
      return t.context.ws
    },
  })
})
