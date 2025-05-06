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

test('Relay', async (t: T) => {
  const relayClient = new BasedClient()
  const listeners: Map<number, (msg: any) => void> = new Map()

  const server = new BasedServer({
    port: 9911,
    silent: true,
    functions: {
      configs: {
        hello: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          fn: async (_, payload) => {
            return 'from hello ' + payload.snap
          },
        },
        a: {
          type: 'channel',
          uninstallAfterIdleTime: 1e3,
          publicPublisher: true,
          publisher: (_, __, msg, id) => {
            listeners.get(id)?.(msg)
          },
          subscriber: (_, __, id, update) => {
            listeners.set(id, update)
            return () => {}
          },
        },
        counter: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          fn: (_, __, update) => {
            let cnt = 1
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

  relayClient.connect({
    url: async () => {
      return 'ws://localhost:9911'
    },
  })

  const serverWithProxy = new BasedServer({
    clients: {
      events: relayClient,
    },
    silent: true,
    port: t.context.port,
    functions: {
      configs: {
        a: {
          type: 'channel',
          uninstallAfterIdleTime: 1e3,
          relay: { client: 'events' },
        },
        b: {
          type: 'channel',
          uninstallAfterIdleTime: 1e3,
          relay: { client: 'events', target: 'a' },
        },
        hello: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          relay: { client: 'events' },
        },
        bye: {
          type: 'function',
          uninstallAfterIdleTime: 1e3,
          relay: { client: 'events', target: 'hello' },
        },
        counter: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          relay: { client: 'events' },
        },
        flap: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          relay: { client: 'events', target: 'counter' },
        },
        derp: {
          type: 'function',
          fn: async (based, payload) => {
            return based.call('bye', payload)
          },
        },
      },
    },
  })
  await serverWithProxy.start()

  const client = new BasedClient()

  client.connect({
    url: async () => {
      return t.context.ws
    },
  })

  const x = await client.query('counter').get()
  t.is(x, 1)
  const hello = await client.call('hello', { snap: 'je' })
  t.is(hello, 'from hello je')
  const msges: any[] = []
  const close = client.channel('a').subscribe((c) => {
    msges.push(c)
  })

  await wait(100)

  client.channel('a').publish('bla')

  await wait(500)

  t.deepEqual(msges, ['bla'])

  const count = await client.query('flap').get()

  t.true(count > 0)

  close()

  const msg2: string[] = []

  const close2 = client.channel('b').subscribe((c) => {
    msg2.push(c)
  })

  await wait(500)

  client.channel('a').publish('bla')

  await wait(500)

  t.true(msg2.length > 0)

  close2()

  const bye = await client.call('bye', { snap: 'je' })
  t.is(bye, 'from hello je')

  const derp = await client.call('derp', { snap: 'je' })
  t.is(derp, 'from hello je')

  await client.destroy()
  await server.destroy()
  await relayClient.destroy()
  await serverWithProxy.destroy()
  t.true(true)
})
