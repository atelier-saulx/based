import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import { wait } from '@based/utils'
import { createPatch } from '@saulx/diff'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('query reuse diff', async (t: T) => {
  const client = new BasedClient()

  const data = {
    x: 1,
  }
  let checksum = 1
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        counter: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          fn: (_, __, update) => {
            // initial will prevent copying
            update(data, checksum, null, undefined, true)
            const counter = setInterval(() => {
              const p = createPatch(data, {
                x: data.x + 1,
                bla: true,
              })
              data.x += 1
              update(data, ++checksum, null, undefined, p)
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

  const obs1Results: any[] = []
  const obs2Results: any[] = []

  const close = client
    .query('counter', {
      myQuery: 123,
    })
    .subscribe((d, checksum) => {
      obs1Results.push([d, checksum])
    })

  await wait(500)
  close()

  const close2 = client
    .query('counter', {
      myQuery: 123,
    })
    .subscribe((d, checksum) => {
      obs2Results.push([d, checksum])
    })

  await wait(1e3)

  t.true(
    !('bla' in server.activeObservables.counter.get(12244891731268)?.rawData),
  )

  t.is(server.activeObservables.counter.get(12244891731268)?.rawData, data)

  close2()

  await server.destroy()
})
