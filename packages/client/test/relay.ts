import test from 'ava'
import { BasedClient } from '../src/index'
import { BasedServer } from '@based/server'
import { wait } from '@saulx/utils'

test.serial('Relay', async (t) => {
  const relayClient = new BasedClient()
  const listeners: Map<number, (msg: any) => void> = new Map()

  const server = new BasedServer({
    port: 9911,
    functions: {
      specs: {
        hello: {
          uninstallAfterIdleTime: 1e3,
          function: async (based, payload) => {
            return 'from hello ' + payload.snap
          },
        },
        a: {
          channel: true,
          uninstallAfterIdleTime: 1e3,
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
        counter: {
          query: true,
          uninstallAfterIdleTime: 1e3,
          function: (based, payload, update) => {
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
    port: 9910,
    functions: {
      specs: {
        a: {
          channel: true,
          uninstallAfterIdleTime: 1e3,
          relay: 'events',
        },
        hello: {
          uninstallAfterIdleTime: 1e3,
          relay: 'events',
        },
        counter: {
          query: true,
          uninstallAfterIdleTime: 1e3,
          relay: 'events',
        },
      },
    },
  })
  await serverWithProxy.start()

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
