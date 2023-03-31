import test from 'ava'
import { BasedClient } from '../src/index'
import { BasedServer } from '@based/server'
import { wait } from '@saulx/utils'
import createPatch from '@saulx/diff'

test.serial('query reuse diff', async (t) => {
  const client = new BasedClient()

  const data = {
    x: 1,
  }
  let checksum = 1
  const server = new BasedServer({
    port: 9910,
    functions: {
      configs: {
        counter: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          fn: (_, __, update) => {
            // initial will prevent copying
            update(data, checksum, null, undefined, true)
            const counter = setInterval(() => {
              const p = createPatch(data, {
                x: data.x + 1,
                bla: true,
              })
              data.x += 1
              update(data, ++checksum, null, undefined, p)
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

  const incoming: { [key: string]: 0 } = {}

  client.on('debug', (d) => {
    if (d.direction !== 'incoming') return
    if (incoming[d.type] === undefined) {
      incoming[d.type] = 0
    }
    if (d.type === 'subscriptionDiff') {
      if (!d.payload.bla) {
        t.fail('No diff passed')
      }
    }
    incoming[d.type]++
  })

  const obs1Results: any[] = []
  const obs2Results: any[] = []

  const close = client
    .query('counter', {
      myQuery: 123,
    })
    .subscribe((d, checksum) => {
      obs1Results.push([d, checksum])
    })

  await wait(500)
  close()

  const close2 = client
    .query('counter', {
      myQuery: 123,
    })
    .subscribe((d, checksum) => {
      obs2Results.push([d, checksum])
    })

  await wait(1e3)

  t.is(incoming.subscribe, 1)
  t.true(incoming.subscriptionDiff > 5)

  t.true(
    !('bla' in server.activeObservables.counter.get(12244891731268)?.rawData)
  )

  t.is(server.activeObservables.counter.get(12244891731268)?.rawData, data)

  close2()

  await server.destroy()
})
