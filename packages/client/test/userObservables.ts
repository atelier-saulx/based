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

test.serial('observable functions not shared call nested', async (t) => {
  // let initCnt = 0
  const server = await createServer({
    port: 9100,
    db: {
      host: 'localhost',
      port: 9099,
    },
    config: {
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
