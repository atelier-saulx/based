import test from 'ava'
import createServer from '@based/server'
import based from '../src'
import { start } from '@saulx/selva-server'
import jwt from 'jsonwebtoken'
import { deepEqual, wait } from '@saulx/utils'
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

test.serial('authorize expired token', async (t) => {
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
      authorizeConnection: async () => {
        return true
      },
      authorize: async ({ user, payload, name, type }) => {
        const token = await user.token('tally-jwt')
        return false
      },
      functions: {
        xhello: {
          observable: false,
          function: async ({ based, payload }) => {
            return based.call('ale', payload)
          },
        },
        hello: {
          observable: false,
          function: async ({ based, payload }) => {
            return based.call('xhello', payload)
          },
        },
      },
    },
  })

  const mySnurx = jwt.sign({ foo: 'bar' }, privateKey, {
    algorithm: 'RS256',
    expiresIn: '-1s',
  })

  const client = based({
    url: async () => {
      return 'ws://localhost:9100'
    },
  })

  await client.auth(mySnurx)

  try {
    await client.call('hello')
    t.fail('renew error nessecary')
  } catch (err) {
    console.info(err)
  }

  t.pass('does not crash')
})
