import test, { ExecutionContext } from 'ava'
import { BasedClient } from '../src/index.js'
import { BasedServer } from '@based/server'
import { wait } from '@based/utils'
import getPort from 'get-port'
import { count } from 'console'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test('query ctx bound on authState.token', async (t: T) => {
  const client = new BasedClient()
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        counter: {
          type: 'query',
          ctx: ['authState.token', 'geo.country'],
          closeAfterIdleTime: 1,
          uninstallAfterIdleTime: 1e3,
          fn: (based, payload, update, error, ctx) => {
            let cnt = 0
            update({ token: ctx.authState.token, cnt })
            const counter = setInterval(() => {
              update({ token: ctx.authState.token, cnt: ++cnt })
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
      return t.context.ws
    },
  })

  await wait(500)

  await client.setAuthState({ token: '?' })
  const results = []

  const close = client
    .query('counter', {
      myQuery: 123,
    })
    .subscribe((d) => {
      results.push({ ...d })
    })

  await wait(300)

  await client.setAuthState({ token: '!' })

  await wait(250)

  close()
  await wait(1000)

  t.deepEqual(
    results,
    [
      { token: '?', cnt: 0 },
      { token: '?', cnt: 1 },
      { token: '?', cnt: 2 },
      { token: '!', cnt: 0 },
      { token: '!', cnt: 1 },
      { token: '!', cnt: 2 },
    ],
    'Changing auth state token',
  )

  t.is(server.activeObservablesById.size, 0)

  await client.destroy()
  await server.destroy()
})

test.only('query ctx bound on authState.userId require auth', async (t: T) => {
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
        counter: {
          type: 'query',
          ctx: ['authState.userId'],
          closeAfterIdleTime: 1,
          uninstallAfterIdleTime: 1e3,
          fn: async (based, payload, update, error, ctx) => {
            if (payload === 'error') {
              error(new Error('error time!'))
            }
            // console.info('yo -> ', payload, ctx)
            let cnt = 0
            update({ userId: ctx.authState.userId, cnt })
            const counter = setInterval(() => {
              update({ userId: ctx.authState.userId, cnt: ++cnt })
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
      return t.context.ws
    },
  })

  await wait(500)

  const results = []

  let close = client
    .query('counter', {
      myQuery: 123,
    })
    .subscribe((d) => {
      results.push({ ...d })
    })

  await wait(300)

  await client.setAuthState({ token: '🔑' })

  // console.log('-> userId',)

  await wait(300)
  console.log(results)

  close()

  // console.log('\n------\nsubscribe next')
  const r2 = []
  close = client.query('counter', 'error').subscribe(
    (d) => {
      r2.push({ ...d })
    },
    (err) => {
      // console.log(err)
    },
  )

  await wait(300)
  // console.log(r2)

  close()

  console.info(await client.query('counter').get())

  console.info(await client.query('counter', { x: true }).get())

  console.info(
    await client
      .query('counter', 'error')
      .get()
      .catch((err) => err),
  )

  // t.deepEqual(
  //   results,
  //   [
  //     { token: '?', cnt: 2 },
  //     { token: '?', cnt: 2 },
  //     { token: '?', cnt: 2 },
  //     { token: '!', cnt: 3 },
  //     { token: '!', cnt: 3 },
  //     { token: '!', cnt: 3 },
  //   ],
  //   'Changing auth state token',
  // )
  await wait(1000)

  t.is(server.activeObservablesById.size, 0)
})
