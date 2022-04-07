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

test.serial('incorrrect payload', async (t) => {
  t.timeout(5000)
  const server = await createServer({
    port: 9333,
    db: {
      host: 'localhost',
      port: 9401,
    },
    config: {
      functions: {
        gurk: {
          observable: false,
          function: async ({ payload, based }) => {
            return { flap: 'x' }
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

  try {
    await client.observe('{{query}}', () => {})
    t.fail('need to throw')
  } catch (err) {
    console.info(err)
    t.is(err.message, 'Observable {{query}} does not exist')
  }

  // t.is(result, null)

  await server.destroy()
  client.disconnect()
})
