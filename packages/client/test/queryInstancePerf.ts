import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import { wait } from '@saulx/utils'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('query functions perf (100k query fn instances)', async (t: T) => {
  const client = new BasedClient()
  let initCnt = 0
  const server = new BasedServer({
    ws: {
      maxBackpressureSize: 1e10,
    },
    rateLimit: {
      ws: 3e6,
      drain: 3e6,
      http: 3e6,
    },
    port: t.context.port,
    functions: {
      closeAfterIdleTime: {
        query: 100,
        channel: 60e3,
      },
      configs: {
        counter: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          fn: (_, payload, update) => {
            const bla: number[] = []
            for (let i = 0; i < 100; i++) {
              bla.push(i)
            }
            update({ cnt: 1, payload, bla })
            initCnt++
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
  client.once('connect', (isConnected) => {
    console.info('   connect', isConnected)
  })

  let subCnt = 0

  console.info(
    `Mem before ${
      Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100
    } MB`,
  )

  const closers: (() => void)[] = []
  for (let i = 0; i < 1e5; i++) {
    closers.push(
      client
        .query('counter', {
          myQuery: i,
        })
        .subscribe(() => {
          subCnt++
        }),
    )
  }

  await wait(11000)
  closers[0]()

  console.info(
    `Mem while active ${
      Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100
    } MB`,
  )

  await wait(11000)
  t.is(server.activeObservablesById.size, 1e5 - 1)
  t.is(Object.keys(server.activeObservables).length, 1)
  t.is(initCnt, 1e5)
  t.is(subCnt, 1e5)

  for (const close of closers) {
    close()
  }

  await wait(5000)
  t.is(Object.keys(server.activeObservables).length, 0)
  t.is(server.activeObservablesById.size, 0)
  await wait(6e3)
  t.is(Object.keys(server.functions.specs).length, 0)

  await server.destroy()
})
