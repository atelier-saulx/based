import { readdir } from 'node:fs/promises'
import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { italy } from './shared/examples.js'
import { deepEqual, equal } from './shared/assert.js'

await test('save simple range', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => {
    // TODO No crash if stopped
    //return db.destroy()
  })

  db.putSchema({
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

  const res = await db.drain()
  console.error('created all nodes', res, 'ms')

  const save1_start = performance.now()
  await db.save()
  const save1_end = performance.now()
  console.error('save1 rdy', save1_end - save1_start, 'ms')
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
  console.error('save2 rdy', save2_end - save2_start, 'ms')
  const secondHash = db.server.merkleTree.getRoot().hash

  equal(save2_end - save2_start < save1_end - save1_start, true)
  equal(firstHash.equals(secondHash), false)

  const ls = await readdir(t.tmp)
  equal(ls.length, N / 100_000 + 3)

  deepEqual(ls, [
    '65282_100001_200000.sdb',
    '65282_1_100000.sdb',
    '65282_200001_300000.sdb',
    '65282_300001_400000.sdb',
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
  console.log('load rdy', load_end - load_start, 'ms')
  const thirdHash = db.server.merkleTree.getRoot().hash

  //console.log([firstHash, secondHash, thirdHash])
  equal(firstHash.equals(secondHash), false)
  equal(secondHash.equals(thirdHash), true)

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
      await newDb.query('user').include('name').range(200_000, 2).get()
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

await test('delete a range', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => {
    return db.destroy()
  })

  db.putSchema({
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

  db.drain()
  db.server.updateMerkleTree()
  const first = fun()
  db.remove('user', 100_001)
  db.drain()
  db.server.updateMerkleTree()
  const second = fun()

  equal(first.hash.equals(second.hash), false, 'delete changes the root hash')
  equal(
    first.left.hash.equals(second.left.hash),
    true,
    "the first block hash wasn't change",
  )
  equal(
    first.right.hash.equals(second.right.hash),
    false,
    'the second block hash a new hash of the deletion',
  )
  equal(second.right.hash.equals(Buffer.alloc(16)), true)

  // TODO In the future the merkleTree should remain the same but the right block doesn't need an sdb
  //db.save()
  //console.log(db.server.merkleTree.getRoot())
})
