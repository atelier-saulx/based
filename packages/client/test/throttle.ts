import test from 'ava'
import { BasedClient } from '../src/index'
import { BasedServer } from '@based/server'
import { wait } from '@saulx/utils'

test.serial('throttle', async (t) => {
  const client = new BasedClient()
  const server = new BasedServer({
    port: 9910,
    auth: {
      authorize: async () => true,
    },
    functions: {
      configs: {
        counter: {
          type: 'query',
          throttle: 1000,
          uninstallAfterIdleTime: 1e3,
          fn: (_, __, update) => {
            console.log(' go go go')
            let cnt = 0
            update(cnt)
            const counter = setInterval(() => {
              console.log('UPDATE')
              update(++cnt)
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
      return 'ws://localhost:9910'
    },
  })

  client.once('connect', (isConnected) => {
    console.info('   connect', isConnected)
  })
  const obs1Results: any[] = []

  const close = client
    .query('counter', {
      myQuery: 123,
    })
    .subscribe((d) => {
      console.info('datax')
      obs1Results.push(d)
    })

  await wait(3000)

  console.log('?xxx?', obs1Results)

  t.is(obs1Results.length, 3)

  close()

  await wait(2000)

  await server.destroy()
  await client.destroy()
})
