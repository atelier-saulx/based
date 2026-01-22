import { readdir } from 'node:fs/promises'
import { BasedDb, DbServer } from '../../src/index.js'
import test from '../shared/test.js'
import { italy } from '../shared/examples.js'
import { deepEqual, equal } from '../shared/assert.js'
import { equals } from '../../src/utils/index.js'
import { getBlockStatuses } from '../../src/db-server/blocks.js'

await test('save simple range', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => {
    return db.destroy()
  })

  await db.setSchema({
    types: {
      user: {
        props: {
          name: { type: 'string' },
          email: { type: 'string' },
          age: { type: 'uint32' },
          story: { type: 'string' },
        },
      },
    },
  })

  const N = 400_000
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

    db.create('user', {
      age: i,
      name: 'mr flop ' + i,
      email: 'abuse@disaster.co.uk',
      story: italy.substring(xn1 * slen, xn2 * slen),
    })
  }

  await db.drain()

  const save1_start = performance.now()
  await db.save()
  const save1_end = performance.now()
  const firstHash = db.server.blockMap.hash

  db.update('user', 1, {
    age: 1337,
  })
  await db.drain()
  deepEqual(
    (await db.query('user').include('age').range(0, 1).get()).toObject(),
    [
      {
        id: 1,
        age: 1337,
      },
    ],
  )

  const save2_start = performance.now()
  await db.stop()
  const save2_end = performance.now()
  const secondHash = db.server.blockMap.hash

  equal(save2_end - save2_start < save1_end - save1_start, true)
  equal(equals(firstHash, secondHash), false)

  const ls = await readdir(t.tmp)
  equal(ls.length, N / 100_000 + 3)

  deepEqual(ls, [
    '2_100001_200000.sdb',
    '2_1_100000.sdb',
    '2_200001_300000.sdb',
    '2_300001_400000.sdb',
    'common.sdb',
    'schema.bin',
    'writelog.json',
  ])

  const load_start = performance.now()
  const newDb = new BasedDb({
    path: t.tmp,
  })
  await newDb.start()
  t.after(() => newDb.destroy())

  const load_end = performance.now()
  const thirdHash = db.server.blockMap.hash

  equal(equals(firstHash, secondHash), false)
  equal(equals(secondHash, thirdHash), true)

  deepEqual(
    (await newDb.query('user').include('age').range(0, 1).get()).toObject(),
    [
      {
        id: 1,
        age: 1337,
      },
    ],
  )
  deepEqual(
    (
      await newDb
        .query('user')
        .include('age')
        .range(200000, 200000 + 1)
        .get()
    ).toObject(),
    [
      {
        id: 200001,
        age: 200001,
      },
    ],
  )

  deepEqual(
    (await newDb.query('user').include('name').range(0, 2).get()).toObject(),
    [
      {
        id: 1,
        name: 'mr flop 1',
      },
      {
        id: 2,
        name: 'mr flop 2',
      },
    ],
  )

  deepEqual(
    (
      await newDb
        .query('user')
        .include('name')
        .range(200_000, 200_000 + 2)
        .get()
    ).toObject(),
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

async function countDirtyBlocks(server: DbServer) {
  let n = 0

  for (const t of Object.keys(server.schemaTypesParsedById)) {
    n += (await getBlockStatuses(server, Number(t))).reduce((acc, cur) => acc + ~~!!(cur & 0x4), 0)
  }

  return n
}

await test('reference changes', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
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
    db.create('user', {
      name: 'mr flop ' + k,
    }),
  )
  await db.drain()
  equal(await countDirtyBlocks(db.server), 1, 'creating new users creates a dirty range')

  db.create('doc', {
    title: 'The Wonders of AI',
    creator: users[0],
  })
  await db.drain()
  equal(await countDirtyBlocks(db.server), 2, 'creating nodes in two types makes both dirty')

  await db.save()
  equal(await countDirtyBlocks(db.server), 0, 'saving clears dirt')

  const doc2 = db.create('doc', {
    title: 'The Slops of AI',
  })
  const doc3 = db.create('doc', {
    title: 'The Hype of AI',
  })
  await db.drain()
  equal(await countDirtyBlocks(db.server), 1, 'creating docs makes the range dirty')
  await db.save()
  equal(await countDirtyBlocks(db.server), 0, 'saving clears dirt')

  // Link user -> doc

  db.update('user', users[1], { docs: [doc2] })

  await db.drain()
  equal(await countDirtyBlocks(db.server), 2, 'Linking a user to doc makes both dirty')
  await db.save()
  equal(await countDirtyBlocks(db.server), 0, 'saving clears dirt')

  // Link doc -> user
  db.update('doc', doc3, { creator: users[2] })
  await db.drain()
  equal(await countDirtyBlocks(db.server), 2, 'Linking a doc to user makes both dirty')
  await db.save()
  equal(await countDirtyBlocks(dbserver), 0, 'saving clears dirt')
})

await test('ref block moves', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
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

  const a1 = await db.create('a', { x: 1 })
  const b1 = await db.create('b', { y: 1, aref: a1 })
  for (let i = 0; i < 100_000; i++) {
    db.create('a', { x: i % 256 })
    db.create('b', { y: i % 256 })
  }
  await db.drain()
  for (let i = 0; i < 100_000; i++) {
    db.delete('a', i + 2)
    db.delete('b', i + 2)
  }
  const an = await db.create('a', { x: 2 })
  const bn = await db.create('b', { y: 2, aref: an })
  await db.save()

  await db.update('a', a1, { bref: bn })
  // t.backup will continue the test from here
})

await test('ref removal', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
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
    const a = db.create('a', { x: i % 256 })
    db.create('b', { y: 255 - (i % 256), aref: a })
  }
  await db.save()
  for (let i = 0; i < 100_000; i++) {
    db.update('a', i + 1, { bref: null })
  }

  // t.backup will continue the test from here
})

await test('refs removal with delete', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
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

  const a = db.create('a', { x: 13 })
  for (let i = 0; i < 10; i++) {
    db.create('b', { y: 255 - (i % 256), aref: a })
  }
  await db.save()
  db.delete('a', a)
})

await test('large block gap', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      b: {
        blockCapacity: 10_000,
        props: {
          y: { type: 'uint8' },
        },
      },
    },
  })

  db.create('b', {
    y: 10,
  })
  for (let i = 268435456; i < 268468224; i++) {
    db.create(
      'b',
      {
        id: i,
        y: i % 255,
      },
      { unsafe: true },
    )
  }

  await db.drain()
})
