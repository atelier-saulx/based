import test from 'ava'
import createServer from '@based/server'
import { wait, deepCopy } from '@saulx/utils'
import based from '../src'
import { start } from '@saulx/selva-server'

// add https://wfuzz.readthedocs.io/en/latest/

let db

const query = {
  things: {
    name: true,
    id: true,
    nested: true,
    $list: {
      $find: {
        $traverse: 'children',
        $filter: {
          $operator: '=',
          $value: 'thing',
          $field: 'type',
        },
      },
    },
  },
}

test.before(async () => {
  const selvaServer = await start({
    port: 9091,
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

test.serial('Dc/Rc mixed subscribe/unsubscribe', async (t) => {
  const server = await createServer({
    port: 9910,
    db: {
      host: 'localhost',
      port: 9091,
    },
  })

  const client = based({
    url: async () => {
      await wait(200)
      return 'ws://localhost:9910'
    },
  })

  const subsResults = [[], [], [], []]

  const subs = await Promise.all([
    client.observe(query, (d) => {
      subsResults[0].push(deepCopy(d))
    }),
    client.observe(query, (d) => {
      subsResults[1].push(deepCopy(d))
    }),
  ])

  await client.set({ type: 'thing', name: 'x' })

  t.throwsAsync(client.set({ error: true }))

  await wait(2e3)

  client.set({ type: 'thing', name: 'z' })

  subs.forEach((f) => f())

  await wait(500)

  const x = await client.observe(query, (d) => {
    subsResults[2].push(deepCopy(d))
  })

  x()

  client.set({ type: 'thing', name: 'blap' })

  const y = await client.observe(query, (d, checksum) => {
    // console.info('LISTENER', d, checksum)
    subsResults[3].push(deepCopy(d))
  })

  await wait(2e3)

  client.disconnect()

  await wait(200)

  db.set({
    type: 'thing',
    name: 'YES!',
  })

  await await wait(2e3)

  client.connect('ws://localhost:9910')

  await await wait(2e3)

  await server.destroy()

  await wait(1e3)

  db.set({
    type: 'thing',
    name: 'YEAH!',
  })

  const server2 = await createServer({
    port: 9910,
    db: {
      host: 'localhost',
      port: 9091,
    },
  })

  await wait(2e3)

  y()

  await wait(2000)

  t.deepEqual(server2.subscriptions, {})

  client.disconnect()

  await wait(100)

  t.deepEqual(server2.clients, {})

  t.deepEqual(subsResults[0].length, 2)
  t.deepEqual(subsResults[1].length, 2)
  t.deepEqual(subsResults[2].length, 1)
  t.deepEqual(subsResults[3].length, 5)

  t.true(
    !!subsResults[3][subsResults[3].length - 1].things.find(
      (v) => v.name === 'YEAH!'
    )
  )

  // double check if observables in selva get removed mem efficient
  await wait(100)
  client.disconnect()
  await server2.destroy()

  t.deepEqual(server.listenSocket, null)
})

test.serial('Corrupt data in subscriptions', async (t) => {
  const server = await createServer({
    port: 9910,
    db: {
      host: 'localhost',
      port: 9091,
    },
  })

  const client = based({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  let data

  const { id } = await client.set({
    type: 'thing',
    name: 'nested thing',
    nested: {
      something: 'ok',
    },
  })

  // client.observe('x,)
  // client.observe('xxx',)

  await client.observe(query, (d, checksum) => {
    // deepCopy as an extra thing in here?
    data = d
  })

  // dont do this! corupts data
  data.things = ['x', 'y']

  await client.set({
    $id: id,
    nested: {
      something: '?',
    },
  })

  await wait(100)

  t.is(data.things.find((t) => t.id === id).nested.something, '?')

  client.client.cache = {}

  await client.set({
    $id: id,
    nested: {
      something: 'x',
    },
  })

  await wait(100)

  t.is(data.things.find((t) => t.id === id).nested.something, 'x')

  client.disconnect()
  await server.destroy()
})

test.serial('Error handling', async (t) => {
  const server = await createServer({
    port: 9910,
    db: {
      host: 'localhost',
      port: 9091,
    },
  })

  const client = based({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  let errorCnt = 0

  try {
    await client.observe(
      {
        $filter: { x: true },
        flap: [{ $filter: true }],
        snurky: {
          flerp: 'xxx',
        },
      },
      (d, checksum) => {
        // deepCopy as an extra thing in here?
      }
    )
  } catch (err) {
    console.error(err)
    errorCnt++
  }

  try {
    await client.set({
      type: 'snurfels',
      name: 'x',
    })
  } catch (err) {
    console.error(err)
    errorCnt++
  }

  await server.destroy()
  await client.disconnect()

  // client.observe({
  // })

  t.is(errorCnt, 2)
})

test.serial('Get', async (t) => {
  const server = await createServer({
    port: 9910,
    db: {
      host: 'localhost',
      port: 9091,
    },
  })

  const client = based({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  const { id } = await client.set({
    type: 'thing',
    name: 'something',
    nested: {
      something: 'xxx',
    },
  })

  const data = await client.get({
    $id: id,
    $all: true,
  })

  t.deepEqual(data, {
    id,
    type: 'thing',
    name: 'something',
    nested: {
      something: 'xxx',
    },
  })

  let errorCnt = 0
  try {
    await client.get({
      id: id,
      $all: true,
    })
  } catch (err) {
    console.error(err)
    errorCnt++
  }

  t.is(errorCnt, 1)
  client.disconnect()
  await server.destroy()
})

test.serial('Configure', async (t) => {
  const server = await createServer({
    port: 9910,
    db: {
      host: 'localhost',
      port: 9091,
    },
  })

  const client = based({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  await client.updateSchema({
    schema: {
      types: {
        person: {
          name: { type: 'string' },
        },
      },
    },
  })

  const config = await client.schema()

  t.is(config.dbs.length, 1)

  client.disconnect()
  await server.destroy()
})
