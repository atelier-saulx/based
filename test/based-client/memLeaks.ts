import test, { ExecutionContext } from 'ava'
import { wait } from '@based/utils'
import getPort from 'get-port'
import { BasedServer } from '../../src/server/index.js'
import { BasedClient } from '../../src/client/index.js'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('mem tests', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        hello: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: async () => {
            await wait(3e3)
            return 'hello'
          },
        },
      },
    },
  })
  await server.start()

  t.log(
    `Mem before ${
      Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100
    } MB`,
  )

  const cl: Set<BasedClient> = new Set()

  for (let i = 0; i < 100; i++) {
    const client = new BasedClient()
    client.connect({
      url: async () => {
        return t.context.ws
      },
    })
    cl.add(client)
  }

  Promise.all(
    [...cl.values()].map((c) => {
      for (let i = 0; i < 1000; i++) {
        c.call('hello').catch(() => {})
      }
      return undefined
    }),
  )

  const used = process.memoryUsage().heapUsed / 1024 / 1024
  t.log(
    `Mem while exec functions disconnect approximately ${
      Math.round(used * 100) / 100
    } MB`,
  )

  await wait(10000)

  const used1 = process.memoryUsage().heapUsed / 1024 / 1024
  t.log(
    `Mem before disconnect approximately ${Math.round(used1 * 100) / 100} MB`,
  )

  for (const client of cl) {
    client.disconnect()
    cl.delete(client)
  }

  await wait(10000)

  // @ts-ignore

  const used2 = process.memoryUsage().heapUsed / 1024 / 1024
  t.log(
    `Mem after disconnect approximately ${Math.round(used2 * 100) / 100} MB`,
  )

  t.true(used2 < 160, 'Does not use too much mem')
})
