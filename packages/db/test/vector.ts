import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('vector', async (t) => {
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

  const data = {
    'cat': [1.5, -0.4, 7.2, 19.6, 20.2],
    'dog': [1.7, -0.3, 6.9, 19.1, 21.1],
    'apple': [-5.2, 3.1, 0.2, 8.1, 3.5],
    'strawberry': [-4.9, 3.6, 0.9, 7.8, 3.6],
    'building': [60.1, -60.3, 10, -12.3, 9.2],
    'car': [81.6, -72.1, 16, -20.2, 102],
  }

  for (const name in data) {
    db.create('data', {
      a: new Float32Array(data[name]),
      name: name,
    })
  }
  db.drain()

  const res = (await db.query('data').get()).toObject()
  for (const r of res) {
    const z = data[r.name]
    for (let i = 0; i < 5; i++) {
        deepEqual(Math.abs(r.a[i] - z[i]) < 0.1, true, `${r.a[i]} ~= ${z[i]}`)
    }
  }
})
