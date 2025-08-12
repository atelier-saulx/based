import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'
import { equals } from '@saulx/utils'

const data = {
  cat: [1.5, -0.4, 7.2, 19.6, 20.2],
  dog: [1.7, -0.3, 6.9, 19.1, 21.1],
  apple: [-5.2, 3.1, 0.2, 8.1, 3.5],
  strawberry: [-4.9, 3.6, 0.9, 7.8, 3.6],
  building: [60.1, -60.3, 10, -12.3, 9.2],
  car: [81.6, -72.1, 16, -20.2, 102],
}

async function initDb(t) {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      data: {
        props: {
          a: {
            type: 'vector',
            size: 5,
            baseType: 'float32',
          },
          age: { type: 'uint32' },
          name: { type: 'string', maxBytes: 10 },
          derp: { type: 'string' },
        },
      },
    },
  })

  for (const name in data) {
    db.create('data', {
      a: new Float32Array(data[name]),
      name: name,
    })
  }
  await db.drain()

  return db
}

await test('vector set/get', async (t) => {
  const db = await initDb(t)

  const res = (await db.query('data').get()).toObject()
  for (const r of res) {
    const a = new Uint8Array(r.a.buffer, 0, r.a.byteLength)
    const b = new Uint8Array(new Float32Array(data[r.name]).buffer)

    equal(equals(a, b), true)
  }
})

await test('vector set wrong size', async (t) => {
  const db = await initDb(t)

  const a = db.create('data', {
    a: new Float32Array([1, 2, 3]),
    name: 'hehe',
  })
  const b = db.create('data', {
    a: new Float32Array([1, 2, 3, 4, 5, 6]),
    name: 'hehe',
  })
  await db.drain()

  const [ra, rb] = await db
    .query('data')
    .filter('id', '=', [await a, await b])
    .include('a')
    .get()

  // RFE is truncation right?
  deepEqual(ra.a.length, 5)
  deepEqual(rb.a.length, 5)
})

await test('query by vector', async (t) => {
  const db = await initDb(t)

  const r1 = await db
    .query('data')
    .include('name')
    .filter('a', '=', new Float32Array(data['car'].slice(0, 5)))
    .get()
    .toObject()
  deepEqual(r1[0].name, 'car')

  const r2 = await db
    .query('data')
    .include('name')
    .filter('a', '=', new Float32Array(data['car']))
    .get()
    .toObject()
  deepEqual(r2.length, 1)
})

// this is broken! see https://linear.app/1ce/issue/FDN-1302 needs alignment!
await test.skip('vector like', async (t) => {
  const db = await initDb(t)

  const fruit = new Float32Array([-5.1, 2.9, 0.8, 7.9, 3.1])
  const res = await db
    .query('data')
    .include('name')
    .filter('a', 'like', fruit, { fn: 'euclideanDistance', score: 1 })
    .get()
    .toObject()

  deepEqual(res, [
    { id: 3, name: 'apple' },
    { id: 4, name: 'strawberry' },
  ])

  for (let i = 0; i < 1e6; i++) {
    db.create('data', {
      a: new Float32Array([i / 1e6, -0.4, 7.2, 19.6, 20.2]),
      name: 'bla ' + i,
      age: i,
    })
  }

  await db.drain()

  deepEqual(
    await db
      .query('data')
      .include('name')
      .range(0, 1e6)
      .filter('a', 'like', fruit, { fn: 'euclideanDistance', score: 1 })
      .get()
      .toObject(),
    [
      {
        id: 3,
        name: 'apple',
      },
      {
        id: 4,
        name: 'strawberry',
      },
    ],
  )
})

await test('search', async (t) => {
  const db = await initDb(t)

  const fruit = new Float32Array([-5.1, 2.9, 0.8, 7.9, 3.1])

  for (let i = 0; i < 1e6; i++) {
    db.create('data', {
      a: new Float32Array([i / 1e5, -0.4, 7.2, 19.6, 20.2]),
      name: 'bla ' + i,
      age: i,
    })
  }

  console.log(await db.drain())

  deepEqual(
    await db
      .query('data')
      .include('id', 'name')
      .range(0, 3)
      .search(fruit, 'a', { fn: 'euclideanDistance', score: 1 })
      .get()
      .inspect()
      .toObject(),
    [
      { id: 3, $searchScore: 0.6100001335144043, name: 'apple' },
      { id: 4, $searchScore: 0.7999996542930603, name: 'strawberry' },
    ],
  )
})

await test('vector misalign', async (t) => {
  const db = await initDb(t)
  for (let i = 0; i < 2; i++) {
    db.create('data', {
      a: new Float32Array([1, 1, 1, 1, 1]),
      derp: '' + i,
      age: i,
    })
  }
  await db.isModified()

  for (let i = 0; i < 2; i++) {
    db.update('data', i + 1, {
      a: new Float32Array([2, 2, 2, 2, 2]),
    })
  }

  await db.isModified()
})
