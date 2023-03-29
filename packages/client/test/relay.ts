import test from 'ava'
import { BasedClient } from '../src/index'
import { createSimpleServer } from '@based/server'
import { wait } from '@saulx/utils'

test.serial('Relay', async (t) => {
  const relayClient = new BasedClient()
  const listeners: Map<number, (msg: any) => void> = new Map()

  const server = await createSimpleServer({
    uninstallAfterIdleTime: 1e3,
    port: 9911,
    functions: {
      hello: async (based, payload) => {
        return 'from hello ' + payload.snap
      },
    },
    channels: {
      a: {
        publisher: {
          public: true,
        },
        publish: (based, payload, msg, id) => {
          listeners.get(id)?.(msg)
        },
        function: (based, payload, id, update) => {
          listeners.set(id, update)
          return () => {}
        },
      },
    },
    queryFunctions: {
      counter: (based, payload, update) => {
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
  })

  relayClient.connect({
    url: async () => {
      return 'ws://localhost:9911'
    },
  })

  const serverWithProxy = await createSimpleServer({
    clients: {
      events: relayClient,
    },
    uninstallAfterIdleTime: 1e3,
    port: 9910,
    channels: {
      a: {
        relay: 'events',
      },
    },
    functions: {
      hello: {
        relay: 'events',
      },
    },
    queryFunctions: {
      counter: {
        relay: 'events',
      },
    },
  })

  const client = new BasedClient()

  client.connect({
    url: async () => {
      return 'ws://localhost:9910'
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

  close()
  await client.destroy()
  await server.destroy()
  await relayClient.destroy()
  await serverWithProxy.destroy()
  t.true(true)
})
