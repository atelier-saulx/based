import test from 'ava'
import { BasedClient } from '../src/index'
import { createSimpleServer } from '@based/server'
import { wait } from '@saulx/utils'
import { join } from 'node:path'

test.serial('persist (nodejs)', async (t) => {
  const client = new BasedClient(
    {},
    {
      persistentStorage: join(__dirname, '/browser/tmp/'),
    }
  )
  const server = await createSimpleServer({
    uninstallAfterIdleTime: 1e3,
    port: 9910,
    queryFunctions: {
      counter: (based, payload, update) => {
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
  })
  client.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })
  client.once('connect', (isConnected) => {
    console.info('   connect', isConnected)
  })

  const r: any[] = []

  const close = client
    .query(
      'counter',
      {
        myQuery: 123,
      },
      { persistent: true }
    )
    .subscribe((d) => {
      r.push(d)
    })

  await wait(500)

  console.info(r)

  t.true(true)

  await client.destroy()
  await server.destroy()
})
