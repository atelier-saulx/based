import test from 'ava'
import createServer from '@based/server'
import { start } from '@saulx/selva-server'
import based from '../src'

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

test.serial('bulkUpdate', async (t) => {
  const server = await createServer({
    port: 9200,
    db: {
      host: 'localhost',
      port: 9201,
    },
  })

  const client = based({
    url: async () => {
      return 'ws://localhost:9200'
    },
  })

  const x = await client.set({
    type: 'thing',
    name: 'snurk',
  })

  await client.bulkUpdate(
    {
      type: 'thing',
      name: 'bla',
    },
    {
      $find: {
        $traverse: 'children',
        $filter: {
          $operator: '=',
          $value: 'thing',
          $field: 'type',
        },
      },
    }
  )

  const snup = await client.get({
    $id: x.id,
    name: true,
  })

  t.is(snup.name, 'bla')

  await server.destroy()
  client.disconnect()
})
