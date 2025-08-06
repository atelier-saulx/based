import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import { wait } from '@based/utils'
import getPort from 'get-port'
import { createInlineFromCurrentCache, createInlineCache } from '../src/ssr.js'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('query cache', async (t: T) => {
  const client = new BasedClient()

  const server = new BasedServer({
    port: t.context.port,
    silent: true,
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

  await server.start()

  client.connect({
    url: async () => {
      return t.context.ws
    },
  })

  await client.query('counter').get()
  await client.query('counter', { bla: true }).get()

  const script = createInlineFromCurrentCache(client, [{ endpoint: 'counter' }])

  t.deepEqual(
    script,
    '<script>window.__basedcache__={"5609164081779":{"v":["flap 0","flap 1","flap 2"],"c":2931330242745,"s":28}}</script>',
  )

  const scriptAll = createInlineFromCurrentCache(client)

  t.deepEqual(
    scriptAll,
    '<script>window.__basedcache__={"5609164081779":{"v":["flap 0","flap 1","flap 2"],"c":2931330242745,"s":28},"12895924860639":{"v":["flap 0","flap 1","flap 2"],"c":2931330242745,"s":28}}</script>',
  )

  client.cache.clear()

  const selectiveGet = await createInlineCache(client, [
    client.query('counter'),
  ])

  t.deepEqual(
    selectiveGet.scriptTag,
    '<script>window.__basedcache__={"5609164081779":{"v":["flap 0","flap 1","flap 2"],"c":2931330242745,"s":28}}</script>',
  )

  await wait(1500)

  await server.destroy()
  client.destroy()
})
