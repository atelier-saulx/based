import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import { wait } from '@based/utils'
import getPort from 'get-port'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('query error nested', async (t: T) => {
  const client = new BasedClient()
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        nested: {
          type: 'query',
          fn: (_, __, update) => {
            const d: { x: number[] } = { x: [] }
            for (let i = 0; i < 1e3; i++) {
              d.x.push(i)
            }
            update(d)
            const interval = setInterval(() => {
              d.x = []
              for (let i = 0; i < 1e3; i++) {
                d.x.push(~~(Math.random() * 3))
              }
              update(d)
            }, 10)
            return () => {
              clearInterval(interval)
            }
          },
        },
        bla: {
          type: 'query',
          fn: (based, _, update) => {
            update(1)
            return based.query('nested').subscribe(
              (r) => {
                r.flap.snurp
              },
              () => {},
            )
          },
        },
        asyncBla: {
          type: 'query',
          fn: (based, _, update, onError) => {
            update(1)
            return based.query('nested').subscribe(async (r) => {
              await wait(1)
              r.cookiepants.snurp
            }, onError)
          },
        },
      },
    },
  })
  await server.start()

  const closers = []

  client.connect({ url: t.context.ws })
  client.query('bla').subscribe(
    () => {},
    () => {},
  )
  let errs = []
  await wait(10)
  client.query('bla', { x: 1 }).subscribe(
    () => {},
    (err) => {
      errs.push(err)
    },
  )
  client.query('bla', new Uint8Array(1000)).subscribe(
    () => {},
    () => {},
  )

  client.query('asyncBla', new Uint8Array(1000)).subscribe(
    () => {},
    () => {},
  )

  client.query('asyncBla', new Uint8Array(1000)).subscribe(
    () => {},
    (err) => {
      errs.push(err)
    },
  )

  await wait(100)

  t.true(errs.length > 4)

  client.disconnect()
  await wait(100)

  // close all thing including the actual uws app
  await server.destroy()
})

test('query error alternate', async (t: T) => {
  const client = new BasedClient()
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        bla: {
          closeAfterIdleTime: 100,
          uninstallAfterIdleTime: 1000,
          type: 'query',
          fn: (based, payload, update, error) => {
            let cnt = 0
            error(new Error(String(cnt)))
            update(cnt)
            const counter = setInterval(() => {
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

  client.connect({ url: t.context.ws })

  const errs = []
  const results = []

  const close = client.query('bla', { x: 1 }).subscribe(
    (d) => {
      results.push(d)
    },
    (err) => {
      errs.push(err.message)
    },
  )

  await wait(1000)

  t.deepEqual(
    { errs, results },
    {
      errs: ['[bla] 0.'],
      results: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    },
  )

  close()
  await wait(1000)

  await client.destroy()
  await server.destroy()

  t.true(true)
})

test('query error alternate auth', async (t: T) => {
  const client = new BasedClient()
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    auth: {
      verifyAuthState: async (_based, _ctx, authState) => {
        if (authState?.token === '🔑') {
          return { userId: 1, token: '🔑' }
        }
        return { token: 'wrong_token' }
      },
      authorize: async (based, ctx, name, payload) => {
        await based.renewAuthState(ctx)
        if (ctx.session.authState.token === '🔑') {
          return true
        }
        return false
      },
    },
    functions: {
      configs: {
        bla: {
          closeAfterIdleTime: 100,
          uninstallAfterIdleTime: 1000,
          type: 'query',
          fn: (based, payload, update, error) => {
            let cnt = 0
            error(new Error(String(cnt)))
            update(cnt)
            const counter = setInterval(() => {
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

  client.connect({ url: t.context.ws })

  const errs = []
  const results = []

  const close = client.query('bla', { x: 1 }).subscribe(
    (d) => {
      results.push(d)
    },
    (err) => {
      errs.push(err.message)
    },
  )

  await client.setAuthState({ token: '🔑' })

  await wait(1000)

  t.deepEqual(
    { errs, results },
    {
      errs: ['[bla] 0.'],
      results: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    },
  )

  close()
  await wait(1000)
  await client.destroy()
  await server.destroy()

  t.true(true)
})
