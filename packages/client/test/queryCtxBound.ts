import test, { ExecutionContext } from 'ava'
import { BasedClient, encodeAuthState } from '../src/index.js'
import { BasedServer } from '@based/server'
import { wait } from '@based/utils'
import getPort from 'get-port'

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

  await client.once('connect')

  await client.setAuthState({ token: '?' })
  const results = []

  const close = client
    .query('counter', {
      myQuery: 123,
    })
    .subscribe((d) => {
      results.push({ ...d })
    })

  await wait(290)

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

test('query ctx bound on authState.userId require auth', async (t: T) => {
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

  await client.once('connect')

  const results = []
  const errs = []

  let close = client
    .query('counter', {
      myQuery: 123,
    })
    .subscribe(
      (d) => {
        results.push({ ...d })
      },
      (err) => {
        errs.push(err.message)
      },
    )

  await wait(290)

  t.deepEqual(
    errs,
    ['[counter] Authorize rejected access.'],
    'Changing auth state err',
  )
  t.deepEqual(results, [], '')

  await client.setAuthState({ token: '🔑' })

  await wait(290)

  t.deepEqual(
    results,
    [
      { userId: 1, cnt: 0 },
      { userId: 1, cnt: 1 },
      { userId: 1, cnt: 2 },
    ],
    'Changing auth state token (valid auth)',
  )

  close()

  const r2 = []
  close = client.query('counter', 'error').subscribe(
    (d) => {
      r2.push({ ...d })
    },
    (err) => {
      // console.log(err)
    },
  )

  await wait(290)

  close()

  t.deepEqual(await client.query('counter').get(), { userId: 1, cnt: 0 })
  t.deepEqual(await client.query('counter', 'bla').get(), { userId: 1, cnt: 0 })

  t.throwsAsync(() => client.query('counter', 'error').get())

  await wait(1000)

  const f = await fetch(
    `${t.context.http}/counter?token=${encodeAuthState({
      token: '🔑',
    })}`,
  )
  const httpGetResult = await f.json()

  t.deepEqual(httpGetResult, { userId: 1, cnt: 0 })

  await wait(1000)

  t.is(server.activeObservablesById.size, 0)
  await client.destroy()
  await server.destroy()
})

test('query ctx bound on geo', async (t: T) => {
  let currentGeo = 1
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    geo: () => {
      currentGeo++
      const isDe = currentGeo % 2
      return {
        country: isDe ? 'DE' : 'NL',
        ip: '192.123.123.1',
        regions: [],
        long: 43.12,
        lat: 23.12,
        accuracy: 0.1,
      }
    },
    functions: {
      configs: {
        counter: {
          type: 'query',
          ctx: ['geo.country'],
          public: true,
          closeAfterIdleTime: 1,
          uninstallAfterIdleTime: 1e3,
          fn: async (based, payload, update, error, ctx) => {
            let cnt = 0
            update({ geo: ctx.geo, cnt })
            const counter = setInterval(() => {
              update({ geo: ctx.geo, cnt: ++cnt })
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
  const client = new BasedClient()
  const client2 = new BasedClient()

  client.connect({
    url: async () => {
      return t.context.ws
    },
  })
  client2.connect({
    url: async () => {
      return t.context.ws
    },
  })

  await Promise.all([client.once('connect'), client2.once('connect')])

  await client.setAuthState({ token: '🔑' })

  const results = []

  const close = client.query('counter').subscribe((d) => {
    results.push({ ...d })
  })

  const close2 = client2.query('counter').subscribe((d) => {
    results.push({ ...d })
  })

  await wait(250)
  t.is(server.activeObservablesById.size, 2)

  t.deepEqual(results, [
    { geo: { country: 'NL' }, cnt: 0 },
    { geo: { country: 'DE' }, cnt: 0 },
    { geo: { country: 'NL' }, cnt: 1 },
    { geo: { country: 'DE' }, cnt: 1 },
    { geo: { country: 'NL' }, cnt: 2 },
    { geo: { country: 'DE' }, cnt: 2 },
  ])

  close()
  close2()
  await wait(1000)

  t.is(server.activeObservablesById.size, 0)

  await client.destroy()
  await server.destroy()
})

test('query ctx bound internal (nested calls)', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        nest: {
          type: 'query',
          ctx: ['authState.token'],
          public: true,
          closeAfterIdleTime: 1,
          uninstallAfterIdleTime: 1e3,
          fn: async (based, payload, update, error, ctx) => {
            let cnt = 0
            update({ ctx, cnt })
            const counter = setInterval(() => {
              update({ ctx, cnt: ++cnt })
            }, 100)
            return () => {
              clearInterval(counter)
            }
          },
        },
        counter: {
          type: 'query',
          ctx: ['authState.token'],
          public: true,
          closeAfterIdleTime: 1,
          uninstallAfterIdleTime: 1e3,
          fn: async (based, payload, update, error, ctx) => {
            return based.query('nest', payload, ctx).subscribe(update)
          },
        },
      },
    },
  })
  await server.start()
  const client = new BasedClient()
  client.connect({
    url: async () => {
      return t.context.ws
    },
  })
  await client.once('connect')
  const results = []
  const close = client.query('counter').subscribe((d) => {
    results.push({ ...d })
  })
  await wait(250)

  await client.setAuthState({ token: '🔑' })

  await wait(250)
  t.deepEqual(results, [
    { ctx: { authState: {} }, cnt: 0 },
    { ctx: { authState: {} }, cnt: 1 },
    { ctx: { authState: {} }, cnt: 2 },
    { ctx: { authState: { token: '🔑' } }, cnt: 0 },
    { ctx: { authState: { token: '🔑' } }, cnt: 1 },
    { ctx: { authState: { token: '🔑' } }, cnt: 2 },
  ])

  close()
  await wait(1000)

  t.is(server.activeObservablesById.size, 0)
  await client.destroy()
  await server.destroy()
})

test('query ctx bound internal (nested call from call)', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        nest: {
          type: 'query',
          ctx: ['authState.token'],
          public: true,
          closeAfterIdleTime: 1,
          uninstallAfterIdleTime: 1e3,
          fn: async (based, payload, update, error, ctx) => {
            let cnt = 0
            update({ ctx, cnt })
            const counter = setInterval(() => {
              update({ ctx, cnt: ++cnt })
            }, 100)
            return () => {
              clearInterval(counter)
            }
          },
        },
        hello: {
          type: 'function',
          public: true,
          uninstallAfterIdleTime: 1e3,
          fn: async (based, payload, ctx) => {
            return based.query('nest', payload, ctx).get()
          },
        },
      },
    },
  })
  await server.start()
  const client = new BasedClient()
  client.connect({
    url: async () => {
      return t.context.ws
    },
  })
  await client.once('connect')
  const results = []
  results.push(await client.call('hello'))

  await client.setAuthState({ token: '🔑' })
  results.push(await client.call('hello'))

  t.deepEqual(results, [
    { ctx: { authState: {} }, cnt: 0 },
    { ctx: { authState: { token: '🔑' } }, cnt: 0 },
  ])

  await wait(1000)

  t.is(server.activeObservablesById.size, 0)
  await client.destroy()
  await server.destroy()
})

// test('ctxBound attachCtx perf', async (t: T) => {
//   let resolve: any
//   const amount = 1e5
//   // add worker
//   let cnt = 0
//   const server = new BasedServer({
//     port: t.context.port,
//     silent: true,
//     functions: {
//       configs: {
//         nest: {
//           type: 'query',
//           ctx: ['authState.token'],
//           public: true,
//           closeAfterIdleTime: 1,
//           uninstallAfterIdleTime: 1e3,
//           fn: async (based, payload, update, error, ctx) => {
//             let cnt = 0
//             update({ ctx, cnt })
//             const counter = setInterval(() => {
//               update({ ctx, cnt: ++cnt })
//             }, 100)
//             return () => {
//               clearInterval(counter)
//             }
//           },
//         },
//         hello: {
//           type: 'function',
//           public: true,
//           uninstallAfterIdleTime: 1e3,
//           fn: async (based, payload, ctx) => {
//             cnt++
//             if (cnt === amount) {
//               resolve()
//             }
//             return based.query('nest', payload, ctx).get()
//           },
//         },
//       },
//     },
//   })
//   await server.start()
//   const client = new BasedClient()
//   client.connect({
//     url: async () => {
//       return t.context.ws
//     },
//   })
//   await client.once('connect')

//   const p = new Promise((r) => {
//     resolve = r
//   })
//   let i = amount
//   let d = Date.now()
//   while (i) {
//     client.call('hello')
//     i--
//   }

//   await p
//   t.log(amount, 'took', Date.now() - d, 'ms')
//   await wait(100 + amount * 0.005)

//   t.true(true)

//   await client.destroy()
//   await server.destroy()
// })
