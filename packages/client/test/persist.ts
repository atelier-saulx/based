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

  client.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  await client.setAuthState({ type: 'boeloe', token: '?', persistent: true })

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
  close()

  await client.destroy()

  const client2 = new BasedClient(
    {},
    {
      persistentStorage: join(__dirname, '/browser/tmp/'),
    }
  )

  t.is(client2.authState.type, 'boeloe')

  let fromStorage: any
  client2
    .query(
      'counter',
      {
        myQuery: 123,
      },
      { persistent: true }
    )
    .subscribe((d) => {
      fromStorage = d
    })

  t.is(fromStorage, 1)

  await wait(500)
  await client2.clearStorage()
  await client2.destroy()
  await server.destroy()
})
