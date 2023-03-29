import test from 'ava'
import { BasedClient } from '../src/index'
import { createSimpleServer } from '@based/server'
import { wait } from '@saulx/utils'
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'

// ADD default persist (on client)

test.serial('persist, store 1M length array or 8mb (nodejs)', async (t) => {
  const persistentStorage = join(__dirname, '/browser/tmp/')

  await mkdir(persistentStorage).catch(() => {})

  const client = new BasedClient(
    {},
    {
      persistentStorage,
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
      bigData: (based, payload, update) => {
        const x: any[] = []
        for (let i = 0; i < 1e6; i++) {
          x.push(i)
        }
        update(x)
        return () => {}
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

  client
    .query(
      'bigData',
      {
        myQuery: 123,
      },
      { persistent: true }
    )
    .subscribe(() => {})

  await wait(2500)
  close()

  await client.destroy()

  const client2 = new BasedClient(
    {},
    {
      persistentStorage,
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

  let x: any

  client2
    .query(
      'bigData',
      {
        myQuery: 123,
      },
      { persistent: true }
    )
    .subscribe((d) => {
      x = d
    })

  t.is(fromStorage, 3)

  t.is(x.length, 1e6)

  await wait(500)
  await client2.clearStorage()
  await client2.destroy(true)
  await server.destroy()
})
