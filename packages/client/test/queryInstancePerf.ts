import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import { wait } from '@based/utils'
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
    silent: true,
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
          uninstallAfterIdleTime: 1000,
          fn: (_, payload, update) => {
            const bla: number[] = []
            for (let i = 0; i < 100; i++) {
              bla.push(i)
            }
            initCnt++
            update({ cnt: 1, payload, bla })
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

  let subCnt = 0

  t.log(
    `Mem before ${
      Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100
    } MB`,
  )

  let d = Date.now()
  let done
  let isReady = new Promise((r) => {
    done = r
  })

  const closers: (() => void)[] = []
  for (let i = 0; i < 1e5; i++) {
    closers.push(
      client
        .query('counter', {
          myQuery: i,
        })
        .subscribe(() => {
          subCnt++
          if (subCnt === 1e5) {
            done()
          }
        }),
    )
  }

  await isReady

  t.log(
    `Mem while active ${
      Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100
    } MB`,
  )

  t.log(`Took ${Date.now() - d}ms to receive 1e5`)

  t.is(server.activeObservablesById.size, 1e5)
  t.is(Object.keys(server.activeObservables).length, 1)
  t.is(initCnt, 1e5, 'Initcnt')
  t.is(subCnt, 1e5, 'Subcnt')

  await wait(500)

  for (const close of closers) {
    close()
  }

  await wait(3e3)

  t.is(
    Object.keys(server.activeObservables).length,
    0,
    'active observables are zero',
  )
  t.is(
    server.activeObservablesById.size,
    0,
    'active observables by id are zero',
  )

  await wait(4e3)

  t.is(Object.keys(server.functions.specs).length, 0, 'no more function specs')

  await server.destroy()
})
