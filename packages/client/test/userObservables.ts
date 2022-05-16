import test from 'ava'
import createServer from '@based/server'
import based, { generateSubscriptionId } from '../src'
import { start } from '@saulx/selva-server'
import jwt from 'jsonwebtoken'
import { wait } from '@saulx/utils'
import { publicKey, privateKey } from './shared/keys'

let db

test.before(async () => {
  const selvaServer = await start({
    port: 9099,
  })
  db = selvaServer.selvaClient
  await selvaServer.selvaClient.updateSchema({
    types: {
      thing: {
        fields: {
          name: { type: 'string' },
          nested: {
            type: 'object',
            properties: {
              something: { type: 'string' },
            },
          },
        },
      },
    },
  })
})

test.after(async () => {
  await db.destroy()
})

test.serial('observable functions not shared', async (t) => {
  t.timeout(15000)
  let initCnt = 0

  const server = await createServer({
    port: 9100,
    db: {
      host: 'localhost',
      port: 9099,
    },
    config: {
      secrets: {
        'tally-jwt': publicKey,
      },
      functions: {
        smurk: {
          shared: false,
          observable: true,
          function: async ({ update, user }) => {
            let cnt = 0
            const token = await user.token('tally-jwt')
            initCnt++
            const interval = setInterval(() => {
              cnt++
              update({
                token,
                cnt,
              })
            }, 1e3)
            return () => {
              return clearInterval(interval)
            }
          },
        },
      },
      authorize: async ({ user }) => {
        const token = user && (await user.token('tally-jwt'))
        if (token && token.user === 'snurp') {
          return false
        }
        return true
      },
    },
  })

  const token = jwt.sign({ user: 'yuz' }, privateKey, { algorithm: 'RS256' })

  const token2 = jwt.sign({ user: 'jurbal' }, privateKey, {
    algorithm: 'RS256',
  })

  const wrongToken = jwt.sign({ user: 'snurp' }, privateKey, {
    algorithm: 'RS256',
  })

  const client = based({
    url: async () => {
      return 'ws://localhost:9100'
    },
  })

  let incomingCnt = 0
  let errorCnt = 0

  client.auth(token)

  client.observe('smurk', () => {
    incomingCnt++
  })

  const client2 = based({
    url: async () => {
      return 'ws://localhost:9100'
    },
  })

  client2.auth(token2)

  client2.observe(
    'smurk',
    () => {
      incomingCnt++
    },
    () => {
      errorCnt++
    }
  )

  await wait(4e3)

  t.is((await client2.get('smurk')).token.user, 'jurbal')

  t.is(incomingCnt, 6)
  t.is(initCnt, 2)

  client2.auth(false)

  await wait(4e3)

  t.is(initCnt, 3)

  client2.auth(token)

  await wait(1e3)

  t.is(initCnt, 4)

  client2.auth(wrongToken)

  await wait(2e3)

  t.is(errorCnt, 1)

  t.is(
    server.subscriptions[generateSubscriptionId(undefined, 'smurk')].clientsCnt,
    1
  )
  client2.auth(token2)

  let x

  try {
    x = await client2.get('smurk')
  } catch (err) {
    console.error(err)
  }

  t.is(x?.token?.user, 'jurbal')

  await wait(1e3)

  client.disconnect()
  client2.disconnect()
  await server.destroy()
  t.pass()
})

test.serial('observable functions not shared call nested', async (t) => {
  t.timeout(5000)
  // let initCnt = 0
  const server = await createServer({
    port: 9100,
    db: {
      host: 'localhost',
      port: 9099,
    },
    config: {
      authorize: async () => true,
      // secrets: {
      //   'tally-jwt': publicKey,
      // },
      functions: {
        a: {
          shared: true,
          observable: true,
          function: async ({ update }) => {
            update({
              rando: Math.random(),
            })
            const int = setInterval(() => {
              update({
                rando: Math.random(),
              })
            }, 500)
            return () => {
              clearInterval(int)
            }
          },
        },
        smurk: {
          shared: false,
          observable: true,
          function: async ({ update }) => {
            let cnt = 0
            const interval = setInterval(() => {
              cnt++
              update({
                cnt,
              })
            }, 1e3)
            return () => {
              return clearInterval(interval)
            }
          },
        },
        flap: {
          shared: false,
          observable: true,
          function: async ({ update, based }) => {
            return based.observe('smurk', (d) => {
              update({
                flap: 'yes',
                d,
              })
            })
          },
        },
      },
    },
  })

  const client = based({
    url: async () => {
      return 'ws://localhost:9100'
    },
  })

  const close = await client.observe('flap', () => {})

  await wait(2e3)

  close()

  await wait(5e3)

  t.is(Object.keys(server.subscriptions).length, 0)

  const x = await client.get('flap')

  t.true(!!x.d.cnt)

  await wait(5e3)

  t.is(Object.keys(server.subscriptions).length, 0)

  client.disconnect()
  // client2.disconnect()
  await server.destroy()
  t.pass()
})
