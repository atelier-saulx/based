import test from 'ava'
import createServer from '@based/server'
import based from '../src'
import { start } from '@saulx/selva-server'
import jwt from 'jsonwebtoken'
import { publicKey, privateKey } from './shared/keys'
import { wait } from '@saulx/utils'

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

  await db.set({ type: 'thing' })
})

test.after(async () => {
  await db.destroy()
})

test.serial('authorize expired token', async (t) => {
  t.timeout(5000)
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
      authorize: async ({ user }) => {
        await user.token('tally-jwt')
        return true
      },
      functions: {
        counter: {
          observable: true,
          shared: true,
          function: async ({ based, update }) => {
            return based.observe(
              {
                $id: 'root',
                id: true,
              },
              update
            )
          },
        },
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

  const client2 = based({
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

  await client2.observe(
    {
      $id: 'root',
      id: true,
      children: true,
    },
    () => {
      console.info('FIRE')
    }
  )

  await wait(2e3)

  await client.observe(
    {
      $id: 'root',
      id: true,
    },
    () => {
      console.info('fire')
    }
  )

  await client.observe('counter', () => {
    console.info('fire 2')
  })

  await wait(1e3)

  t.pass('does not crash')

  client.disconnect()
  await server.destroy()
})
