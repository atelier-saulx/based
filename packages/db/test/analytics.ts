import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

await test('analytics', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  t.after(() => {
    return db.destroy()
  })

  await db.start({ clean: true })

  await db.putSchema({
    types: {
      _client: {
        props: {
          name: 'string',
        },
      },
      page: {
        name: 'string',
        clients: {
          items: {
            ref: '_client',
            prop: 'pages',
            $viewers: 'uint8',
          },
        },
        // activeViewers: {
        //   type: 'uint32',
        //   path: 'clients.$viewers.#sum',
        // },
      },
    },
  })

  const client = await db.create('_client', {})
  const client2 = await db.create('_client', {})
  const page = await db.create('page', {
    clients: [
      {
        id: client,
        $viewers: { increment: 1 },
      },
    ],
  })

  await db.update('page', page, {
    clients: {
      add: [
        {
          id: client,
          $viewers: { increment: 1 },
        },
      ],
    },
  })

  console.dir(
    await db.query('page').include('clients.$viewers').get().toObject(),
    { depth: null },
  )

  await db.update('page', page, {
    clients: {
      add: [
        {
          id: client,
          $viewers: { increment: 1 },
        },
      ],
    },
  })

  console.dir(
    await db.query('page').include('clients.$viewers').get().toObject(),
    { depth: null },
  )

  await db.update('page', page, {
    clients: {
      add: [
        {
          id: client,
          $viewers: { increment: -1 },
        },
      ],
    },
  })

  await db.update('page', page, {
    clients: {
      add: [
        {
          id: client2,
          $viewers: { increment: 1 },
        },
      ],
    },
  })

  console.dir(
    await db.query('page').include('clients.$viewers').get().toObject(),
    { depth: null },
  )

  db.remove('_client', client2)

  await db.drain()

  console.dir(
    await db.query('page').include('clients.$viewers.#sum').get().toObject(),
    { depth: null },
  )
})
