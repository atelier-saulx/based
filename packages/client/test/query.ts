import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import { deepCopy, wait } from '@based/utils'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('query functions', async (t: T) => {
  const client = new BasedClient()
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        counter: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          fn: (_, __, update) => {
            let cnt = 0
            update(cnt)
            const counter = setInterval(() => {
              update(++cnt)
            }, 1000)
            return () => {
              clearInterval(counter)
            }
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

  const obs1Results: any[] = []
  const obs2Results: any[] = []

  const close = client
    .query('counter', {
      myQuery: 123,
    })
    .subscribe((d) => {
      obs1Results.push(d)
    })

  const close2 = client
    .query('counter', {
      myQuery: 123,
    })
    .subscribe((d) => {
      obs2Results.push(d)
    })

  await wait(500)
  close()
  server.functions.updateInternal({
    type: 'query',
    name: 'counter',
    version: 2,
    uninstallAfterIdleTime: 1e3,
    maxPayloadSize: 1e9,
    rateLimitTokens: 1,
    fn: (_, __, update) => {
      let cnt = 0
      const counter = setInterval(() => {
        update('counter2:' + ++cnt)
      }, 100)
      return () => {
        clearInterval(counter)
      }
    },
  })
  await wait(1e3)
  close2()
  t.true(obs1Results.length < obs2Results.length)
  t.true(obs2Results[obs2Results.length - 1].startsWith('counter2:'))
  await wait(100)
  t.is(Object.keys(server.activeObservables).length, 1)
  t.is(server.activeObservablesById.size, 1)
  await wait(5000)
  t.is(Object.keys(server.activeObservables).length, 0)
  t.is(server.activeObservablesById.size, 0)
  await wait(6e3)
  t.is(Object.keys(server.functions.specs).length, 0)
})

test('Date support', async (t: T) => {
  const client = new BasedClient()
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        counter: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          fn: (_, __, update) => {
            let cnt = 0
            const bla = { id: 1, x: new Date(cnt), cnt }
            update(bla)
            const counter = setInterval(() => {
              cnt += 1000
              const x = {
                x: new Date(cnt),
                cnt,
              }

              update(x)
            }, 100)
            return () => {
              clearInterval(counter)
            }
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

  const updates = []

  const close = client.query('counter').subscribe((d) => {
    updates.push(deepCopy(d))
  })

  await wait(300)

  t.deepEqual(
    [
      { id: 1, x: '1970-01-01T00:00:00.000Z', cnt: 0 },
      { x: '1970-01-01T00:00:01.000Z', cnt: 1000 },
      { x: '1970-01-01T00:00:02.000Z', cnt: 2000 },
    ],
    updates,
  )

  close()

  t.true(true)
})
