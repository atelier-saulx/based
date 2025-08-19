import test, { ExecutionContext } from 'ava'
import { BasedServer } from '@based/server'
import { wait } from '@based/utils'
import fetch from 'cross-fetch'
import { BasedClient } from '../src/index.js'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('rate limit', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        flap: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: async () => {
            return {}
          },
        },
      },
    },
  })
  await server.start()

  const coreClient = new BasedClient()

  let limits = 0

  for (let i = 0; i < 2e3; i++) {
    const x = await fetch(t.context.http + '/flap', {
      method: 'get',
      headers: {
        'content-type': 'application/json',
      },
    })
    if (x.status === 429) {
      limits++
    }
  }

  coreClient.connect({
    url: async () => {
      return t.context.ws
    },
  })

  t.is(limits, 1501)

  let isConnect = false
  coreClient.once('connect', () => {
    isConnect = true
  })

  await wait(5e3)

  t.is(isConnect, false)

  await wait(10e3)

  t.is(Object.keys(server.functions.specs).length, 0)

  server.destroy()
})
