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

test.serial('copy', async (t) => {
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

  const x = await client.set({
    type: 'thing',
    name: 'snurk',
    nested: {
      something: 'its ok',
    },
    children: [
      {
        type: 'thing',
        name: 'x1',
        $id: 'th1',
      },
      {
        type: 'thing',
        name: 'x2',
        children: [
          {
            type: 'thing',
            name: 'z1',
            parents: { $add: 'root' },
          },
          {
            type: 'thing',
            name: 'z2',
            parents: { $add: ['th1'] },
          },
        ],
      },
    ],
  })

  const copyResult = await client.copy({
    $id: x.id,
    parents: ['root'],
    deep: false,
  })

  t.is(copyResult.ids.length, 1)

  const copyResult2 = await client.copy({
    $id: x.id,
    deep: true,
  })

  t.is(copyResult2.ids.length, 5)

  const parentsIds = new Set()

  const allThings = await Promise.all(
    copyResult2.ids.map((v) =>
      client.get({ $id: v, parents: { $list: true, id: true } })
    )
  )

  for (const c of allThings) {
    for (const p of c.parents) {
      parentsIds.add(p.id)
    }
  }

  t.is(parentsIds.size, 4)

  t.true(parentsIds.has('root'))

  for (const id of [...parentsIds]) {
    if (id !== 'root' && !copyResult2.ids.find((v) => v === id)) {
      t.fail('mystery id')
    }
  }

  const copyResult3 = await client.copy({
    $id: x.id,
    excludeFields: ['nested'],
  })

  const copyResult3Get = await client.get({
    $id: copyResult3.ids[0],
    $all: true,
  })

  t.false('nested' in copyResult3Get)

  await server.destroy()
  client.disconnect()
})
