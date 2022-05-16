import test from 'ava'
import createServer from '@based/server'
import { start } from '@saulx/selva-server'
import based from '../src'
import { wait } from '@saulx/utils'

let db

test.before(async () => {
  const selvaServer = await start({
    port: 9201,
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

test.serial('observeSchema', async (t) => {
  t.timeout(5000)
  const server = await createServer({
    port: 9200,
    db: {
      host: 'localhost',
      port: 9201,
    },
    config: {
      authorize: async () => true,
    },
  })

  const client = based({
    url: async () => {
      return 'ws://localhost:9200'
    },
  })

  let sha
  const x = await client.observeSchema((d) => {
    sha = d.sha
  })

  await wait(200)

  x()

  t.truthy(sha)

  t.pass()
  await server.destroy()
  client.disconnect()
})
