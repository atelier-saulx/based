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

test('query perf', async (t: T) => {
  const waitUntilReceived = 100
  const amountOfNumbers = 1e6
  const client = new BasedClient()
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
      configs: {
        counterUint8: {
          type: 'query',
          fn: (_, payload, update) => {
            const bla = new Uint8Array(amountOfNumbers)
            for (let i = 0; i < amountOfNumbers; i++) {
              bla[i] = i % 2
            }
            let cnt = 0
            update(bla)
            const int = setInterval(() => {
              cnt++
              update(bla, cnt)
            })
            return () => {
              clearInterval(int)
            }
          },
        },
        counter: {
          type: 'query',
          fn: (_, payload, update) => {
            const bla = []
            for (let i = 0; i < amountOfNumbers; i++) {
              bla[i] = i % 2
            }
            let cnt = 0
            update(bla)
            const int = setInterval(() => {
              cnt++
              update(bla, cnt)
            })
            return () => {
              clearInterval(int)
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

  let subCnt = 0
  let d = Date.now()
  let done
  let isReady = new Promise((r) => {
    done = r
  })

  let close = client
    .query('counter', {
      myQuery: 1,
    })
    .subscribe(() => {
      subCnt++
      if (subCnt === waitUntilReceived) {
        done()
      }
    })

  await isReady

  t.log(
    `Took JSON ${Date.now() - d}ms to receive ${waitUntilReceived}x ${amountOfNumbers / 1000}k numbers`,
  )

  close()

  subCnt = 0
  d = Date.now()
  isReady = new Promise((r) => {
    done = r
  })

  close = client
    .query('counterUint8', {
      myQuery: 1,
    })
    .subscribe(() => {
      subCnt++
      if (subCnt === waitUntilReceived) {
        done()
      }
    })

  await isReady

  t.log(
    `Took UINT8 ${Date.now() - d}ms to receive ${waitUntilReceived}x ${amountOfNumbers / 1000}k numbers`,
  )

  await server.destroy()

  t.pass()
})
