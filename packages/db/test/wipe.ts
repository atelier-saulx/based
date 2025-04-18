import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { throws, deepEqual } from './shared/assert.js'

await test('wipe', async (t) => {
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
          },
          age: { type: 'uint32' },
          name: { type: 'string', maxBytes: 10 },
        },
      },
    },
  })

  for (let i = 0; i < 1e6; i++) {
    db.create('data', {
      age: i,
    })
  }

  deepEqual(await db.query('data').range(0, 10).get(), [
    { id: 1, age: 0, name: '' },
    { id: 2, age: 1, name: '' },
    { id: 3, age: 2, name: '' },
    { id: 4, age: 3, name: '' },
    { id: 5, age: 4, name: '' },
    { id: 6, age: 5, name: '' },
    { id: 7, age: 6, name: '' },
    { id: 8, age: 7, name: '' },
    { id: 9, age: 8, name: '' },
    { id: 10, age: 9, name: '' },
  ])

  await db.wipe()

  await db.setSchema({
    types: {
      x: {
        props: {
          a: {
            type: 'vector',
            size: 5,
          },
          age: { type: 'uint32' },
          name: { type: 'string', maxBytes: 10 },
        },
      },
    },
  })

  await throws(() => db.query('data').get())

  for (let i = 0; i < 1e6; i++) {
    db.create('x', {
      age: i,
    })
  }

  deepEqual(await db.query('x').range(0, 10).get(), [
    { id: 1, age: 0, name: '' },
    { id: 2, age: 1, name: '' },
    { id: 3, age: 2, name: '' },
    { id: 4, age: 3, name: '' },
    { id: 5, age: 4, name: '' },
    { id: 6, age: 5, name: '' },
    { id: 7, age: 6, name: '' },
    { id: 8, age: 7, name: '' },
    { id: 9, age: 8, name: '' },
    { id: 10, age: 9, name: '' },
  ])
})
