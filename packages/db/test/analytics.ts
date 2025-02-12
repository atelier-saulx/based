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
      client: {
        name: 'string',
        bees: {
          items: {
            ref: 'page',
            prop: 'clients',
          },
        },
      },
      page: {
        name: 'string',
        clients: {
          items: {
            ref: 'client',
            prop: 'bees',
            $users: 'uint8',
          },
        },
      },
    },
  })

  const client = await db.create('client', {})
  const client2 = await db.create('client', {})
  const page = await db.create('page', {
    clients: [
      {
        id: client,
        $users: { increment: 1 },
      },
    ],
  })

  await db.update('page', page, {
    clients: {
      add: [
        {
          id: client,
          $users: { increment: 1 },
        },
      ],
    },
  })

  console.dir(
    await db.query('page').include('clients.$users').get().toObject(),
    { depth: null },
  )

  await db.update('page', page, {
    clients: {
      add: [
        {
          id: client,
          $users: { increment: 1 },
        },
      ],
    },
  })

  console.dir(
    await db.query('page').include('clients.$users').get().toObject(),
    { depth: null },
  )

  await db.update('page', page, {
    clients: {
      add: [
        {
          id: client,
          $users: { increment: -1 },
        },
      ],
    },
  })

  await db.update('page', page, {
    clients: {
      add: [
        {
          id: client2,
          $users: { increment: 1 },
        },
      ],
    },
  })

  console.dir(
    await db.query('page').include('clients.$users').get().toObject(),
    { depth: null },
  )

  db.remove('client', client2)

  await db.drain()

  console.dir(
    await db.query('page').include('clients.$users').get().toObject(),
    { depth: null },
  )
})
