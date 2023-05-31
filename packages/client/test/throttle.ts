import test from 'ava'
import { BasedClient } from '../src/index'
import { BasedServer } from '@based/server'
import { wait } from '@saulx/utils'

test.serial('throttle', async (t) => {
  const client = new BasedClient()
  const server = new BasedServer({
    port: 9910,
    functions: {
      configs: {
        counter: {
          type: 'query',
          throttle: 1000,
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
      return 'ws://localhost:9910'
    },
  })

  client.once('connect', (isConnected) => {
    console.info('   connect', isConnected)
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

  close()

  await wait(1000)

  await server.destroy()
  await client.destroy()
})
