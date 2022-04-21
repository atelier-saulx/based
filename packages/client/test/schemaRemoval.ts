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
      flap: {
        prefix: 'fl',
        fields: {
          name: { type: 'string' },
          nurk: { type: 'string' },
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

test.serial('remove type', async (t) => {
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

  const q = []

  for (let i = 0; i < 2; i++) {
    q.push(
      client.set({
        type: 'thing',
        name: 'thing - ' + i,
      })
    )
  }

  const ids = await Promise.all(q)

  await client.removeType('thing')

  const result = await Promise.all(
    ids.map(({ id }) => client.get({ $id: id, id: true }))
  )

  for (const r of result) {
    if (!r.$isNull) {
      t.fail('Did not remove item')
    }
  }

  t.pass('all good')

  await server.destroy()
  client.disconnect()
})

test.serial('remove field', async (t) => {
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

  const q = []

  for (let i = 0; i < 100; i++) {
    q.push(
      client.set({
        type: 'flap',
        name: 'thing - ' + i,
        nurk: 'nurk - ' + i,
        nested: {
          something: 'something - ' + i,
        },
      })
    )
  }

  const ids = await Promise.all(q)

  await client.removeField('flap', 'nurk')

  const result = await Promise.all(
    ids.map(({ id }) => client.get({ $id: id, nurk: true }))
  )

  for (const r of result) {
    if (r.nurk) {
      t.fail('Did not remove field')
    }
  }

  try {
    await client.set({
      type: 'flap',
      nurk: 'no no name no no  - ',
    })
    t.fail('should throw')
  } catch (err) {}

  await client.removeField('flap', 'name')

  const result2 = await Promise.all(
    ids.map(({ id }) => client.get({ $id: id, name: true }))
  )

  for (const r of result2) {
    if (r.name) {
      t.fail('Did not remove field')
    }
  }

  try {
    await client.set({
      type: 'flap',
      name: 'no no name no no  - ',
    })
    t.fail('should throw')
  } catch (err) {
    console.info(err)
  }

  await client.removeField('flap', ['nested', 'properties', 'something'])

  const result3 = await Promise.all(
    ids.map(({ id }) => client.get({ $id: id, nested: { something: true } }))
  )

  for (const r of result3) {
    if (r.nested?.something) {
      t.fail('Did not remove field')
    }
  }

  try {
    await client.set({
      type: 'flap',
      nested: {
        something: 'something - ',
      },
    })
    t.fail('should throw')
  } catch (err) {
    console.info(err)
  }

  t.pass('All seems good')
  await server.destroy()
  client.disconnect()
})

test.after(async () => {
  await db.destroy()
})
