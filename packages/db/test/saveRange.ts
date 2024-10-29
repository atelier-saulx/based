import { join as pathJoin } from 'node:path'
import { copyFile, mkdir, readdir } from 'node:fs/promises'
import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { italy } from './shared/examples.js'
import { deepEqual, equal } from './shared/assert.js'

await test('save simple range', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  db.blockSize = 100_000

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
          manifesto: { type: 'string' },
        },
      },
    },
  })

  //const N = 10_000_000
  const N = 400_000
  const slen = 80
  const xn_len = italy.length / slen
  for (let i = 1; i <= N; i++) {
    let xn1 = ((i * slen) / slen | 0) % xn_len
    let xn2 = (xn1 + 1) % xn_len

    if (xn1 > xn2) {
      xn1 ^= xn2;
      xn2 ^= xn1;
      xn1 ^= xn2;
    }

    db.create('user', {
      age: i,
      name: 'mr flop ' + i,
      email: 'abuse@disaster.co.uk',
      manifesto: italy.substring(xn1 * slen, xn2 * slen),
    })
  }

  const res = db.drain()
  console.error('created all nodes', res)

  const save1_start = performance.now()
  await db.save()
  const save1_end = performance.now()
  console.error('save1 rdy', save1_end - save1_start)
  const firstHash = db.merkleTree.getRoot().hash

  db.update('user', 1, {
    age: 10,
  })
  db.drain()
  deepEqual(
    db
      .query('user')
      .include('age')
      .range(0, 1)
      .get()
      .toObject(),
    [
      {
        id: 1,
        age: 10,
      },
    ],
  )

  const save2_start = performance.now()
  await db.stop()
  const save2_end = performance.now()
  console.error('save2 rdy', save2_end - save2_start)
  const secondHash = db.merkleTree.getRoot().hash

  equal((save2_end - save2_start) < (save1_end - save1_start), true)
  console.log(firstHash, secondHash)
  equal(!firstHash.compare(secondHash), false)

  const ls = await readdir(t.tmp)
  equal(ls.length, N / 100_000 + 4)
  deepEqual(ls,
  [
    '65281_100001_200000.sdb',
    '65281_1_100000.sdb',
    '65281_200001_300000.sdb',
    '65281_300001_400000.sdb',
    'common.sdb',
    'data.mdb',
    'schema.json',
    'writelog.json'
  ])

  const load_start = performance.now()
  const newDb = new BasedDb({
    path: t.tmp,
  })
  db.blockSize = 100_000
  await newDb.start()
  t.after(() => {
    return newDb.destroy()
  })
  const load_end = performance.now()
  console.log('load rdy', load_end - load_start)

  deepEqual(
    newDb
      .query('user')
      .include('name')
      .range(0, 2)
      .get()
      .toObject(),
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
    newDb
      .query('user')
      .include('name')
      .range(200_000, 2)
      .get()
      .toObject(),
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
