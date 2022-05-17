import test from 'ava'
import createServer from '@based/server'
import based from '../src'
import { SelvaClient } from '@saulx/selva'
import { start } from '@saulx/selva-server'
import jwt from 'jsonwebtoken'
import { publicKey, privateKey } from './shared/keys'

let db: SelvaClient

test.before(async () => {
  const selvaServer = await start({
    port: 9299,
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

test.serial(
  'auth with isBasedUser with existing authorize function',
  async (t) => {
    const server = await createServer({
      port: 9101,
      db: {
        host: 'localhost',
        port: 9299,
      },
      config: {
        authorize: async () => {
          return false
        },
        getBasedKey: async () => {
          return publicKey
        },
      },
    })

    const client = based({
      url: async () => {
        return 'ws://localhost:9101'
      },
    })

    try {
      await client.get({
        $id: 'root',
        id: true,
        name: true,
      })
      t.fail('Needs to throw')
    } catch (err) {
      t.true(err.name.includes('AuthorizationError'))
    }

    const token = jwt.sign({ foo: 'bar' }, privateKey, { algorithm: 'RS256' })

    client.auth(token, { isBasedUser: true })

    const y = await client.get({
      $id: 'root',
      id: true,
      name: true,
    })

    t.is(y?.id, 'root')

    await server.destroy()
    client.disconnect()
  }
)

test.serial('auth with isBasedUser with expired token', async (t) => {
  const server = await createServer({
    port: 9101,
    db: {
      host: 'localhost',
      port: 9299,
    },
    config: {
      authorize: async () => {
        return false
      },
      getBasedKey: async () => {
        return publicKey
      },
    },
  })

  const client = based({
    url: async () => {
      return 'ws://localhost:9101'
    },
  })

  try {
    await client.get({
      $id: 'root',
      id: true,
      name: true,
    })
    t.fail('Needs to throw')
  } catch (err) {
    t.true(err.name.includes('AuthorizationError'))
  }

  const token = jwt.sign({ foo: 'bar' }, privateKey, {
    algorithm: 'RS256',
    expiresIn: '-1s',
  })

  client.auth(token, { isBasedUser: true })

  await t.throwsAsync(
    client.get({
      $id: 'root',
      id: true,
      name: true,
    })
  )

  await server.destroy()
  client.disconnect()
})
