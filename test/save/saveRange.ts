import { readdir } from 'node:fs/promises'
import { DbClient, getDefaultHooks } from '../../src/index.js'
import { DbServer } from '../../src/sdk.js'
import test from '../shared/test.js'
import { italy } from '../shared/examples.js'
import { deepEqual, equal, notEqual } from '../shared/assert.js'
import { countDirtyBlocks, hashType, testDbClient } from '../shared/index.js'

await test('save simple range', async (t) => {
  const db = new DbServer({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => {
    return db.destroy()
  })

  const schema = {
    types: {
      user: {
        props: {
          name: { type: 'string' },
          email: { type: 'string' },
          age: { type: 'uint32' },
          story: { type: 'string' },
        },
      },
      mute: {},
    },
  } as const
  const client = await testDbClient(db, schema)

  const N = 800_000
  const slen = 80
  const xn_len = italy.length / slen
  for (let i = 1; i <= N; i++) {
    let xn1 = (((i * slen) / slen) | 0) % xn_len
    let xn2 = (xn1 + 1) % xn_len

    if (xn1 > xn2) {
      xn1 ^= xn2
      xn2 ^= xn1
      xn1 ^= xn2
    }

    client.create('user', {
      age: i,
      name: 'mr flop ' + i,
      email: 'abuse@disaster.co.uk',
      story: italy.substring(xn1 * slen, xn2 * slen),
    })
  }

  await client.drain()

  const save1_start = performance.now()
  await db.save()
  const save1_end = performance.now()
  const firstHash = await hashType(db, 'user')

  client.update('user', 1, {
    age: 1337,
  })
  await client.drain()
  deepEqual(await client.query('user').include('age').range(0, 1).get(), [
    {
      id: 1,
      age: 1337,
    },
  ])

  const save2_start = performance.now()
  await db.save()
  const save2_end = performance.now()
  const secondHash = await hashType(db, 'user')
  await db.stop()

  //console.log(save2_end - save2_start, save1_end - save1_start)
  equal(save2_end - save2_start < save1_end - save1_start, true)
  notEqual(firstHash, secondHash)

  const ls = await readdir(t.tmp)
  equal(ls.length, N / 100_000 + 3)

  deepEqual(ls, [
    '1_common.sdb',
    '2_0.sdb',
    '2_1.sdb',
    '2_2.sdb',
    '2_3.sdb',
    '2_4.sdb',
    '2_5.sdb',
    '2_6.sdb',
    '2_7.sdb',
    '2_common.sdb',
    'schema.bin',
  ])

  //const load_start = performance.now()
  const db2 = new DbServer({
    path: t.tmp,
  })
  await db2.start()
  t.after(() => db2.destroy())
  //const load_end = performance.now()

  const client2 = new DbClient<typeof schema>({
    hooks: getDefaultHooks(db2),
  })

  const thirdHash = await hashType(db2, 'user')
  notEqual(firstHash, secondHash)
  equal(secondHash, thirdHash)

  deepEqual(await client2.query('user').include('age').range(0, 1).get(), [
    {
      id: 1,
      age: 1337,
    },
  ])
  deepEqual(
    await client2
      .query('user')
      .include('age')
      .range(200000, 200000 + 1)
      .get(),
    [
      {
        id: 200001,
        age: 200001,
      },
    ],
  )

  deepEqual(await client2.query('user').include('name').range(0, 2).get(), [
    {
      id: 1,
      name: 'mr flop 1',
    },
    {
      id: 2,
      name: 'mr flop 2',
    },
  ])

  deepEqual(
    await client2
      .query('user')
      .include('name')
      .range(200_000, 200_000 + 2)
      .get(),
    [
      {
        id: 200001,
        name: 'mr flop 200001',
      },
      {
        id: 200002,
        name: 'mr flop 200002',
      },
    ],
  )
})

await test('reference changes', async (t) => {
  const db = new DbServer({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const client = await testDbClient(db, {
    types: {
      user: {
        props: {
          name: { type: 'string' },
          docs: { items: { ref: 'doc', prop: 'creator' } },
        },
      },
      doc: {
        props: {
          title: { type: 'string' },
          creator: { ref: 'user', prop: 'docs' },
          related: { items: { ref: 'doc', prop: 'related' } },
        },
      },
    },
  })

  const users = Array.from({ length: 3 }, (_, k) =>
    client.create('user', {
      name: 'mr flop ' + k,
    }),
  )
  await client.drain()
  equal(
    await countDirtyBlocks(db),
    1,
    'creating new users creates a dirty range',
  )

  client.create('doc', {
    title: 'The Wonders of AI',
    creator: users[0],
  })
  await client.drain()
  equal(
    await countDirtyBlocks(db),
    2,
    'creating nodes in two types makes both dirty',
  )

  await db.save()
  equal(await countDirtyBlocks(db), 0, 'saving clears dirt')

  const doc2 = client.create('doc', {
    title: 'The Slops of AI',
  })
  const doc3 = client.create('doc', {
    title: 'The Hype of AI',
  })
  await client.drain()
  equal(await countDirtyBlocks(db), 1, 'creating docs makes the range dirty')
  await db.save()
  equal(await countDirtyBlocks(db), 0, 'saving clears dirt')

  // Link user -> doc
  client.update('user', users[1], { docs: [doc2] })
  await client.drain()
  equal(await countDirtyBlocks(db), 2, 'Linking a user to doc makes both dirty')
  await db.save()
  equal(await countDirtyBlocks(db), 0, 'saving clears dirt')

  // Link doc -> user
  client.update('doc', doc3, { creator: users[2] })
  await client.drain()
  equal(await countDirtyBlocks(db), 2, 'Linking a doc to user makes both dirty')
  await db.save()
  equal(await countDirtyBlocks(db), 0, 'saving clears dirt')
})

await test('ref block moves', async (t) => {
  const db = new DbServer({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const client = await testDbClient(db, {
    types: {
      a: {
        props: {
          bref: { ref: 'b', prop: 'aref' },
          x: { type: 'uint8' },
        },
      },
      b: {
        props: {
          aref: { ref: 'a', prop: 'bref' },
          y: { type: 'uint8' },
        },
      },
    },
  })

  const a1 = await client.create('a', { x: 1 })
  const b1 = await client.create('b', { y: 1, aref: a1 })
  for (let i = 0; i < 100_000; i++) {
    client.create('a', { x: i % 256 })
    client.create('b', { y: i % 256 })
  }
  await client.drain()
  for (let i = 0; i < 100_000; i++) {
    client.delete('a', i + 2)
    client.delete('b', i + 2)
  }
  const an = await client.create('a', { x: 2 })
  const bn = await client.create('b', { y: 2, aref: an })
  await db.save()

  await client.update('a', a1, { bref: bn })
  // t.backup will continue the test from here
})

await test('ref removal', async (t) => {
  const db = new DbServer({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const client = await testDbClient(db, {
    types: {
      a: {
        props: {
          bref: { ref: 'b', prop: 'aref' },
          x: { type: 'uint8' },
        },
      },
      b: {
        props: {
          aref: { ref: 'a', prop: 'bref' },
          y: { type: 'uint8' },
        },
      },
    },
  })

  for (let i = 0; i < 100_000; i++) {
    const a = client.create('a', { x: i % 256 })
    client.create('b', { y: 255 - (i % 256), aref: a })
  }
  await db.save()
  for (let i = 0; i < 100_000; i++) {
    client.update('a', i + 1, { bref: null })
  }

  // t.backup will continue the test from here
})

await test('refs removal with delete', async (t) => {
  const db = new DbServer({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const client = await testDbClient(db, {
    types: {
      a: {
        props: {
          brefs: { items: { ref: 'b', prop: 'aref' } },
          x: { type: 'uint8' },
        },
      },
      b: {
        props: {
          aref: { ref: 'a', prop: 'brefs' },
          y: { type: 'uint8' },
        },
      },
    },
  })

  const a = client.create('a', { x: 13 })
  for (let i = 0; i < 10; i++) {
    client.create('b', { y: 255 - (i % 256), aref: a })
  }
  await db.save()
  client.delete('a', a)
})

await test('large block gap', async (t) => {
  const db = new DbServer({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const client = await testDbClient(db, {
    types: {
      b: {
        blockCapacity: 10_000,
        props: {
          y: { type: 'uint8' },
        },
      },
    },
  })

  client.create('b', {
    y: 10,
  })

  // TODO make this work unsafe
  for (let i = 268435456; i < 268468224; i++) {
    client.create(
      'b',
      {
        id: i,
        y: i % 255,
      },
      { unsafe: true },
    )
  }

  await client.drain()
})
