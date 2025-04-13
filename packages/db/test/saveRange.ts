import { readdir } from 'node:fs/promises'
import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { italy } from './shared/examples.js'
import { deepEqual, equal } from './shared/assert.js'
import { hashEq } from '../src/server/csmt/tree.js'

await test('save simple range', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => {
    // TODO No crash if stopped
    // return db.destroy()
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
  const firstHash = db.server.merkleTree.getRoot().hash

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
  const secondHash = db.server.merkleTree.getRoot().hash

  equal(save2_end - save2_start < save1_end - save1_start, true)
  equal(hashEq(firstHash, secondHash), false)

  const ls = await readdir(t.tmp)
  equal(ls.length, N / 100_000 + 3)

  deepEqual(ls, [
    '2_100001_200000.sdb',
    '2_1_100000.sdb',
    '2_200001_300000.sdb',
    '2_300001_400000.sdb',
    'common.sdb',
    'schema.json',
    'writelog.json',
  ])

  const load_start = performance.now()
  const newDb = new BasedDb({
    path: t.tmp,
  })
  await newDb.start()
  t.after(() => {
    return newDb.destroy()
  })
  const load_end = performance.now()
  const thirdHash = db.server.merkleTree.getRoot().hash

  equal(hashEq(firstHash, secondHash), false)
  equal(hashEq(secondHash, thirdHash), true)

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

// TODO This test needs a little bit more fixing
await test.skip('delete a range', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => {
    return t.backup(db)
  })

  await db.setSchema({
    types: {
      user: {
        props: {
          name: { type: 'string' },
        },
      },
    },
  })

  const N = 100_001
  for (let i = 1; i <= N; i++) {
    db.create('user', {
      name: 'mr flop ' + i,
    })
  }

  const fun = () => {
    const { hash, left, right } = db.server.merkleTree.getRoot()
    return { hash, left, right }
  }

  await db.drain()
  db.save()
  const first = fun()
  db.delete('user', 100_001)
  await db.drain()
  db.save()
  const second = fun()

  equal(hashEq(first.hash, second.hash), false, 'delete changes the root hash')
  equal(
    hashEq(first.left.left.hash, second.left.left.hash),
    true,
    "the first block hash wasn't change",
  )
  equal(
    hashEq(first.left.right.hash, second.left.right.hash),
    false,
    'the second block hash a new hash of the deletion',
  )
  equal(hashEq(second.right.hash, new Uint8Array(16)), true)
  equal(hashEq(second.left.right.hash, new Uint8Array(16)), true)

  db.save()
})

await test('reference changes', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => {
    return t.backup(db)
  })

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
  equal(
    db.server.dirtyRanges.size,
    1,
    'creating new users creates a dirty range',
  )

  db.create('doc', {
    title: 'The Wonders of AI',
    creator: users[0],
  })
  await db.drain()
  equal(
    db.server.dirtyRanges.size,
    2,
    'creating nodes in two types makes both dirty',
  )

  await db.save()
  equal(db.server.dirtyRanges.size, 0, 'saving clears the dirty set')

  const doc2 = db.create('doc', {
    title: 'The Slops of AI',
  })
  const doc3 = db.create('doc', {
    title: 'The Hype of AI',
  })
  await db.drain()
  equal(db.server.dirtyRanges.size, 1, 'creating docs makes the range dirty')
  await db.save()
  equal(db.server.dirtyRanges.size, 0, 'saving clears the dirty set')

  // Link user -> doc

  db.update('user', users[1], { docs: [doc2] })

  await db.drain()
  equal(db.server.dirtyRanges.size, 2, 'Linking a user to doc makes both dirty')
  await db.save()
  equal(db.server.dirtyRanges.size, 0, 'saving clears the dirty set')

  // Link doc -> user
  db.update('doc', doc3, { creator: users[2] })
  await db.drain()
  equal(db.server.dirtyRanges.size, 2, 'Linking a doc to user makes both dirty')
  await db.save()
  equal(db.server.dirtyRanges.size, 0, 'saving clears the dirty set')
})
