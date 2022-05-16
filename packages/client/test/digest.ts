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
          password: { type: 'digest' },
        },
      },
    },
  })
})

test.after(async () => {
  await db.destroy()
})

// need to add 'salt' for the hashing function in the db for passwords - can be a config in based server
test.serial('digest', async (t) => {
  t.timeout(5000)
  const server = await createServer({
    port: 9333,
    db: {
      host: 'localhost',
      port: 9401,
    },
    config: {
      authorize: async () => true,
    },
  })

  const client = based({
    url: async () => {
      return 'ws://localhost:9333'
    },
  })

  const password = 'schaap99'

  const id = await db.set({
    type: 'thing',
    password,
  })

  const record = await db.get({ $id: id, password: true })

  const hashedPassword = await client.digest(password)

  t.is(hashedPassword, record.password)

  await server.destroy()
  client.disconnect()
})
