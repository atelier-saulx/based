import test, { ExecutionContext } from 'ava'
import { BasedClient, encodeAuthState } from '../src/index.js'
import { BasedServer } from '@based/server'
import { deepCopy, wait } from '@based/utils'
import getPort from 'get-port'
import { EventEmitter } from 'node:events'

type T = ExecutionContext<{ port: number; ws: string; http: string }>

test.beforeEach(async (t: T) => {
  t.context.port = await getPort()
  t.context.ws = `ws://localhost:${t.context.port}`
  t.context.http = `http://localhost:${t.context.port}`
})

test.serial('query ctx bound + default verifyAuthState', async (t: T) => {
  const client = new BasedClient()
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    auth: {
      authorize: async (based, ctx, name, payload) => {
        await based.renewAuthState(ctx, {
          userId: 1,
          token: ctx.session.authState.token,
        })
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

test.serial('query ctx bound on authState.token', async (t: T) => {
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

test.serial(
  'query ctx bound on authState.userId require auth',
  async (t: T) => {
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
    t.deepEqual(await client.query('counter', 'bla').get(), {
      userId: 1,
      cnt: 0,
    })

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
  },
)

test.serial('query ctx bound on geo', async (t: T) => {
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

test.serial('query ctx bound internal (nested calls)', async (t: T) => {
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

test.serial(
  'query ctx bound internal (nested call from call)',
  async (t: T) => {
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
  },
)

test.serial('ctxBound attachCtx perf', async (t: T) => {
  let resolve: any
  const amount = 1e5
  let cnt = 0
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        nest: {
          type: 'query',
          ctx: ['authState.token', 'geo.country'],
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
          rateLimitTokens: 0,
          uninstallAfterIdleTime: 1e3,
          fn: async (based, payload, ctx) => {
            cnt++
            if (cnt === amount) {
              resolve()
            }
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
  const p = new Promise((r) => {
    resolve = r
  })
  let i = amount
  let d = Date.now()
  while (i) {
    client.call('hello')
    i--
  }

  await p
  t.log(amount, 'took', Date.now() - d, 'ms')
  await wait(100 + amount * 0.005)

  t.true(true)
  await wait(1000)

  await client.destroy()
  await server.destroy()
})

test.serial('ctxBound get', async (t: T) => {
  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        nest: {
          type: 'query',
          ctx: ['authState.token', 'geo.country'],
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
  let res = await client.query('nest').get()
  res = await client.query('nest').get()
  t.deepEqual(res, {
    ctx: { authState: {}, geo: { country: 'unknown' } },
    cnt: 0,
  })
  await client.destroy()
  await server.destroy()
  t.true(true)
})

test.serial('ctxBound strange diff mismatch', async (t: T) => {
  const missions = [
    {
      id: 1,
      notes: 'derp1',
      plannedStartedAt: 1000,
    },

    {
      id: 2,
      notes: 'derp2',
      plannedStartedAt: 2000,
    },

    {
      id: 3,
      notes: 'derp3',
      plannedStartedAt: 3000,
    },
  ]

  /*
  2026-02-17T14:41:05.011Z {"id":2,"createdAt":"2026-02-17T14:41:04.964Z","updatedAt":"2026-02-17T14:41:04.964Z","name":"sub-test-1771339264950","manufacturer":"","model":"","firmwareVersion":"","isDecommissioned":false,"notes":"","serialNumber":"","weightInGrams":0,"workspace":{"id":1},"assignedToTeams":[],"customAttributes":null}
2026-02-17T14:41:05.611Z {"id":2,"createdAt":"2026-02-17T14:41:04.964Z","updatedAt":"2026-02-17T14:41:04.964Z","name":"sub-test-1771339264950","manufacturer":"","model":"","firmwareVersion":"","isDecommissioned":false,"notes":"Sub test 1771339265492","serialNumber":"","weightInGrams":0,"workspace":{"id":1},"assignedToTeams":[],"customAttributes":null,"purchasedAt":"2026-02-11T00:00:00.000Z"}
2026-02-17T14:41:07.613Z {"id":2,"createdAt":"2026-02-17T14:41:04.964Z","updatedAt":"2026-02-17T14:41:04.964Z","name":"sub-test-1771339264950","manufacturer":"","model":"","firmwareVersion":"","isDecommissioned":false,"notes":"Sub test 2 1771339267530","serialNumber":"","weightInGrams":0,"workspace":{"id":1},"assignedToTeams":[],"customAttributes":null,"purchasedAt":"2026-02-11T00:00:00.000Z"}
  */

  const emitter = new EventEmitter()

  const findId = (id) => {
    return (v) => v.id === id
  }

  const server = new BasedServer({
    port: t.context.port,
    silent: true,
    functions: {
      configs: {
        list: {
          type: 'query',
          ctx: ['authState.token', 'authState.userId'],
          public: true,
          fn: async (based, payload, update, error, ctx) => {
            update(missions)
            const listener = () => {
              update(missions)
            }
            emitter.on('data', listener)
            return () => {
              emitter.off('data', listener)
            }
          },
        },
        mission: {
          uninstallAfterIdleTime: 10000,
          type: 'query',
          ctx: ['authState.token', 'authState.userId'],
          public: true,
          fn: async (based, payload, update, error, ctx) => {
            update(missions.find(findId(payload.id)))
            const listener = () => {
              update(missions.find(findId(payload.id)))
            }
            emitter.on('data', listener)
            return () => {
              emitter.off('data', listener)
            }
          },
        },
        update: {
          type: 'function',
          public: true,
          fn: async (based, payload, ctx) => {
            const mission = missions.find(findId(payload.id))
            Object.assign(mission, payload)
            emitter.emit('data')
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

  await client.setAuthState({
    userId: 1,
  })

  const workspaceId = 1

  const listResult = await client
    .query('list', { workspace: { id: workspaceId } })
    .get()

  const missionId = listResult?.[0]?.id

  const updates: unknown[] = []
  const unsubscribe = client
    .query('mission', { id: missionId })
    .subscribe((mission) => {
      updates.push(deepCopy(mission))
    })

  await wait(1000)

  const newNotes = `Sub test ${Date.now()}`
  const newPlannedStartedAt = new Date(Date.UTC(2026, 1, 11))

  await client.call('update', {
    id: missionId,
    notes: newNotes,
    plannedStartedAt: newPlannedStartedAt,
  })

  await wait(1000)

  const firstUpdate = updates[updates.length - 1] as Record<string, unknown>

  const notesOk1 = firstUpdate.notes === newNotes
  const plannedStartedAtOk1 =
    new Date(firstUpdate.plannedStartedAt as string | number).getTime() ===
    newPlannedStartedAt.getTime()

  const newNotes2 = `Sub test 2 ${Date.now()}`
  const newPlannedStartedAt2 = new Date(
    newPlannedStartedAt.getTime() + 24 * 60 * 60 * 1000,
  )

  await client.call('update', {
    id: missionId,
    notes: newNotes2,
    plannedStartedAt: newPlannedStartedAt2,
  })

  await wait(1000)

  const secondUpdate = updates[updates.length - 1] as Record<string, unknown>

  const notesOk2 = secondUpdate.notes === newNotes2
  const plannedStartedAtOk2 =
    new Date(secondUpdate.plannedStartedAt as string | number).getTime() ===
    newPlannedStartedAt2.getTime()

  const allPassed =
    notesOk1 && plannedStartedAtOk1 && notesOk2 && plannedStartedAtOk2

  console.log({ allPassed, updates })

  unsubscribe()

  await client.destroy()
  await server.destroy()
  t.true(allPassed)
})
