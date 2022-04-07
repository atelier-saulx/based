import test from 'ava'
import createServer from '@based/server'
import { start } from '@saulx/selva-server'
import based from '@based/client'
import { SelvaClient } from '@saulx/selva'

let db: SelvaClient

test.before(async () => {
  const selvaServer = await start({
    port: 9401,
  })
  db = selvaServer.selvaClient
})

test.after(async () => {
  await db.destroy()
})

test.serial('redis set', async (t) => {
  t.timeout(5000)
  const server = await createServer({
    port: 9333,
    db: {
      host: 'localhost',
      port: 9401,
    },
    config: {
      functions: {
        redisSet: {
          observable: false,
          function: async ({ payload, based }) => {
            const result = await based.redis.set(payload.key, payload.message)
            return result
          },
        },
      },
    },
  })

  const client = based({
    url: async () => {
      return 'ws://localhost:9333'
    },
  })

  const key = 'xdy'
  const message = 'this is a test'

  await client.call('redisSet', { key, message })

  const result = await db.redis.get(key)

  t.is(result, message)

  await server.destroy()
  client.disconnect()
})

test.serial('redis get', async (t) => {
  t.timeout(5000)
  const server = await createServer({
    port: 9333,
    db: {
      host: 'localhost',
      port: 9401,
    },
    config: {
      functions: {
        redisGet: {
          observable: false,
          function: async ({ payload, based }) => {
            const result = await based.redis.get(payload.key)
            return result
          },
        },
      },
    },
  })

  const client = based({
    url: async () => {
      return 'ws://localhost:9333'
    },
  })

  const key = 'xdy'
  const message = 'this is a test'

  await db.redis.set(key, message)

  const result = await client.call('redisGet', { key }).then((r) => String(r))

  t.is(result, message)

  await server.destroy()
  client.disconnect()
})

test.serial('redis delete', async (t) => {
  t.timeout(5000)
  const server = await createServer({
    port: 9333,
    db: {
      host: 'localhost',
      port: 9401,
    },
    config: {
      functions: {
        redisDelete: {
          observable: false,
          function: async ({ payload, based }) => {
            const result = await based.redis.del(payload.key)
            return result
          },
        },
      },
    },
  })

  const client = based({
    url: async () => {
      return 'ws://localhost:9333'
    },
  })

  const key = 'xdy'
  const message = 'this is a test'

  await db.redis.set(key, message)

  await client.call('redisDelete', { key }).then((r) => String(r))

  const result = await db.redis.get(key)

  t.is(result, null)

  await server.destroy()
  client.disconnect()
})
