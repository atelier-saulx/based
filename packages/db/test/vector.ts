import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

const data = {
  'cat': [1.5, -0.4, 7.2, 19.6, 20.2],
  'dog': [1.7, -0.3, 6.9, 19.1, 21.1],
  'apple': [-5.2, 3.1, 0.2, 8.1, 3.5],
  'strawberry': [-4.9, 3.6, 0.9, 7.8, 3.6],
  'building': [60.1, -60.3, 10, -12.3, 9.2],
  'car': [81.6, -72.1, 16, -20.2, 102],
}

async function initDb(t) {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.putSchema({
    types: {
      data: {
        props: {
          a: {
            type: 'vector',
            size: 5,
          },
          name: { type: 'string' },
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

  return db;
}

await test('vector set/get', async (t) => {
  const db = await initDb(t)

  const res = (await db.query('data').get()).toObject()
  for (const r of res) {
    const a = Buffer.from(r.a.buffer)
    const b = Buffer.from((new Float32Array(data[r.name])).buffer)

    deepEqual(Buffer.compare(a, b), 0)
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

  const [ra, rb] = await db.query('data').filter('id', '=', [a, b]).include('a').get()

  // RFE is truncation right?
  deepEqual(ra.a.length, 5)
  deepEqual(rb.a.length, 5)
})

await test('query by vector', async (t) => {
  const db = await initDb(t)

  const r1 = await db.query('data').filter('a', '=', new Float32Array(data['car'].slice(0, 4))).get()
  console.log(r1)

  const r2 = await db.query('data').filter('a', '=', new Float32Array(data['car'])).get()
  console.log(r2)

  const r3 = await db.query('data').filter('a', '=', new Float32Array([...data['car'], 1])).get()
  console.log(r3)
})

await test('vector like', async (t) => {
  const db = await initDb(t)

  const fruit = new Float32Array([-5.1, 2.9, 0.8, 7.9, 3.1])
  const res = await db.query('data').include('name').filter('a', 'like', fruit).get().toObject()
  deepEqual([{ id: 5, name: 'building' }, { id: 6, name: 'car' }], res)
})
