import test from 'ava'
import createServer from '@based/server'
import { start } from '@saulx/selva-server'
import based from '../src'

let db

test.before(async () => {
  const selvaServer = await start({
    port: 9401,
  })
  db = selvaServer.selvaClient
  await selvaServer.selvaClient.updateSchema({
    types: {
      thing: {
        prefix: 'th',
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

test.serial('id', async (t) => {
  t.timeout(5000)
  const server = await createServer({
    port: 9333,
    db: {
      host: 'localhost',
      port: 9401,
    },
    config: {
      authorize: async () => true,
      functions: {
        hello: {
          observable: false,
          function: async ({ payload, user }) => {
            // payload can also be the next segment in the url
            return {
              snapje: 'ja',
            }
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

  const x = await client.id('thing')

  t.true(x.length < 11)
  t.true(x.startsWith('th'))

  const y = await client.id('thing', {
    x: 'hello',
    y: 'yesh',
    name: 'snurkyplurf',
  })

  t.true(y.length < 11)
  t.true(y.startsWith('th'))

  await server.destroy()
  client.disconnect()
})
