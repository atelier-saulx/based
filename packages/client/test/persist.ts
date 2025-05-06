import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import { wait } from '@saulx/utils'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'url'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const TMP = join(__dirname, '../tmp/')

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test.serial('persist, store 1M length array or 8mb (nodejs)', async (t: T) => {
  const persistentStorage = join(TMP, '1m')

  await mkdir(persistentStorage, { recursive: true }).catch((err) => {})
  const opts = {
    url: async () => {
      return t.context.ws
    },
  }
  const client = new BasedClient(opts, {
    persistentStorage,
  })
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        counter: {
          type: 'query',
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

  await client.setAuthState({ type: 'boeloe', token: '?', persistent: true })

  const r: any[] = []

  const close = client
    .query(
      'counter',
      {
        myQuery: 123,
      },
      { persistent: true },
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
      { persistent: true },
    )
    .subscribe(() => {})

  await wait(2500)
  close()

  await wait(200)

  await client.destroy()
  await server.destroy()

  const client2 = new BasedClient(opts, {
    persistentStorage,
  })

  t.is(client2.authState.type, 'boeloe')

  let fromStorage: any
  await new Promise((resolve) =>
    client2
      .query(
        'counter',
        {
          myQuery: 123,
        },
        { persistent: true },
      )
      .subscribe((d) => {
        fromStorage = d
        resolve(d)
      }),
  )

  let x: any

  await new Promise((resolve) =>
    client2
      .query(
        'bigData',
        {
          myQuery: 123,
        },
        { persistent: true },
      )
      .subscribe((d) => {
        resolve(d)
        x = d
      }),
  )

  t.is(fromStorage, 3)

  t.is(x.length, 1e6)

  t.teardown(async () => {
    await client2.clearStorage()
    await client2.destroy(true)
  })
})

test.serial('auth persist', async (t: T) => {
  const persistentStorage = join(TMP, 'auth')

  await mkdir(persistentStorage, { recursive: true }).catch(() => {})

  const token = 'this is token'
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    auth: {
      verifyAuthState: async (_, ctx, authState) => {
        if (authState.token !== ctx.session?.authState.token) {
          return { ...authState, type: 'over9000' }
        }
        return true
      },
      authorize: async (based, ctx) => {
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
            await based.renewAuthState(ctx, {
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

  const opts = {
    url: async () => {
      return t.context.ws
    },
  }

  const client = new BasedClient(
    {},
    {
      persistentStorage,
    },
  )

  await client.connect(opts)
  await client.call('login')

  await wait(6000)

  t.is(client.authState.token, token)

  await t.notThrowsAsync(client.call('hello'))
  await wait(300)
  await client.destroy()

  const client2 = new BasedClient(opts, {
    persistentStorage,
  })

  t.is(client2.authState.token, token)

  await t.notThrowsAsync(client2.call('hello'))

  t.teardown(async () => {
    await wait(100)
    await client.clearStorage()
    await server.destroy()
    await client2.clearStorage()
    await client2.destroy()
  })
})
