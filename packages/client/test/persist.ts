import test from 'ava'
import { BasedClient } from '../src/index'
import { BasedServer } from '../../server/src'
import { wait } from '@saulx/utils'
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'

test.serial('persist, store 1M length array or 8mb (nodejs)', async (t) => {
  const persistentStorage = join(__dirname, '/browser/tmp/')

  await mkdir(persistentStorage).catch(() => {})

  const client = new BasedClient(
    {},
    {
      persistentStorage,
    }
  )
  const server = new BasedServer({
    port: 9910,
    functions: {
      configs: {
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
        bigData: {
          type: 'query',
          uninstallAfterIdleTime: 1e3,
          fn: (_, __, update) => {
            const x: any[] = []
            for (let i = 0; i < 1e6; i++) {
              x.push(i)
            }
            update(x)
            return () => {}
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

test.serial.only('auth persist', async (t) => {
  const persistentStorage = join(__dirname, '/browser/tmp/')
  await mkdir(persistentStorage).catch(() => {})

  const token = 'this is token'
  const server = new BasedServer({
    port: 9910,
    auth: {
      authorize: async (based, ctx, name) => {
        if (name) {
          return true
        }

        await based.renewAuthState(ctx)
        const userId = ctx.session?.authState.userId
        if (!userId) return false
        else return true
      },
    },
    functions: {
      configs: {
        hello: {
          name: 'hello',
          type: 'function',
          fn: async () => {
            return { hello: 'ok' }
          },
        },
        login: {
          name: 'login',
          type: 'function',
          public: true,
          fn: async (based, _payload, ctx) => {
            based.renewAuthState(ctx, {
              userId: 'thisIsId',
              token,
              persistent: true,
            })
            return { ok: true }
          },
        },
      },
    },
  })
  await server.start()

  const client = new BasedClient(
    {},
    {
      persistentStorage,
    }
  )
  t.teardown(async () => {
    await client.clearStorage()
    await server.destroy()
  })

  await client.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  await client.call('login')

  await wait(1300)

  t.is(client.authState.token, token)

  await t.notThrowsAsync(client.call('hello'))

  await wait(300)

  // await client.destroy()

  const client2 = new BasedClient(
    {},
    {
      persistentStorage,
    }
  )

  // console.info('>>>??S?sd', client2)
  // t.is(client2.authState.token, token)

  t.teardown(async () => {
    await client2.clearStorage()
    await client2.destroy()
  })
  await client2.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  // this is where its at
  console.log('call hello and not throw!')

  await t.notThrowsAsync(client2.call('hello'))
})
