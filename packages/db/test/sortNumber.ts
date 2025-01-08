import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'

await test('numbers', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  const animals = ['pony', 'whale', 'dolphin', 'dog']

  db.putSchema({
    types: {
      example: {
        props: {
          animal: animals,
          age: { type: 'uint32' },
          isNice: { type: 'boolean' },
        },
      },
    },
  })

  db.server.createSortIndex('example', 'age')

  const len = 10

  for (let i = 0; i < len; i++) {
    await db.create('example', {
      age: i,
      animal: animals[i % animals.length],
      isNice: i % 2 > 0,
    })
  }

  db.drain()

  await db.update('example', 1, {
    age: { increment: 1e9 },
  })

  deepEqual(
    await db
      .query('example')
      .sort('age')
      .include('age')
      .get()
      .then((v) => v.toObject()),
    [
      { id: 2, age: 1 },
      { id: 3, age: 2 },
      { id: 4, age: 3 },
      { id: 5, age: 4 },
      { id: 6, age: 5 },
      { id: 7, age: 6 },
      { id: 8, age: 7 },
      { id: 9, age: 8 },
      { id: 10, age: 9 },
      { id: 1, age: 1000000000 },
    ],
  )
})
