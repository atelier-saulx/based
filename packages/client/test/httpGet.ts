import test from 'ava'
import { BasedServer } from '@based/server'
import fetch from 'cross-fetch'
import { wait } from '@saulx/utils'
import { encodeAuthState } from '../src/index.js'

test.serial('http get falsy check', async (t) => {
  const server = new BasedServer({
    port: 9910,
    functions: {
      configs: {
        bla: {
          type: 'query',
          closeAfterIdleTime: 3e3,
          uninstallAfterIdleTime: 1e3,
          fn: (_, __, update) => {
            update(0)
            return () => {}
          },
        },
      },
    },
    auth: {
      authorize: async () => true,
    },
  })
  await server.start()

  for (let i = 0; i < 100; i++) {
    const r1 = await (await fetch('http://localhost:9910/bla')).json()
    t.is(r1, 0)
    await wait(100)

    const r2 = await (await fetch('http://localhost:9910/bla')).text()
    t.is(r2, '0')

    await wait(100)
    const r3 = await (await fetch('http://localhost:9910/bla')).text()
    t.is(r3, '0')
  }

  await server.destroy()
})

test.only('http get authorize', async (t) => {
  const server = new BasedServer({
    port: 9910,
    functions: {
      configs: {
        yeye: {
          type: 'function',
          maxPayloadSize: 1e6,
          rateLimitTokens: 1,
          version: 1,
          fn: async (_based, _payload) => {
            return { ok: true }
          },
        },
        bla: {
          type: 'query',
          fn: (_based, payload, update) => {
            console.info(payload)
            update(payload)
            return () => {}
          },
        },
      },
    },
    auth: {
      authorize: async (_, context) => {
        if (context.session?.authState.token === 'bla') {
          return true
        }
        return false
      },
    },
  })
  await server.start()

  const r1 = await fetch('http://localhost:9910/yeye')
  const rj1 = await r1.json()
  t.is(r1.status, 403)
  t.is(rj1.code, 40301)

  const authorization = encodeAuthState({
    token: 'bla',
  })
  const r2 = await fetch(`http://localhost:9910/yeye?token=${authorization}`)
  const rj2 = await r2.json()

  t.is(r2.status, 200)
  t.true(rj2.ok)

  const q1 = await fetch(
    `http://localhost:9910/bla?token=${authorization}&hello=world`
  )
  const qj1 = await q1.json()
  t.deepEqual(qj1, { hello: 'world' })

  const wrongAuthorization = encodeAuthState({
    token: 'wrong',
  })
  const r3 = await fetch(
    `http://localhost:9910/yeye?token=${wrongAuthorization}`
  )
  const rj3 = await r3.json()
  t.is(r3.status, 403)
  t.is(rj3.code, 40301)

  const invalidAuthorization = 'sdlkfjklsjf2354'
  const r4 = await fetch(
    `http://localhost:9910/yeye?token=${invalidAuthorization}`
  )
  const rj4 = await r4.json()
  t.is(r4.status, 403)
  t.is(rj4.code, 40301)

  await server.destroy()
})
