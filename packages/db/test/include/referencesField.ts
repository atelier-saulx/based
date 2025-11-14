import test from '../shared/test.js'
import { BasedDb } from '../../src/index.js'
import { deepEqual } from '../shared/assert.js'

await test('references shortcut', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          name: 'string',
          age: 'uint8',
          friends: {
            items: {
              ref: 'user',
              prop: 'friends',
            },
          },
        },
      },
    },
  })

  const mrA = await db.create('user', {
    name: 'Mr a',
    age: 50,
    friends: [db.create('user', { name: 'Mr b', age: 25 })],
  })

  for (let i = 0; i < 10; i++) {
    db.create('user', { name: 'Mr ' + i, age: 92 + i, friends: [mrA] })
  }

  deepEqual(
    await db.query('user', mrA).include('name', 'age', 'friends[0].age').get(),
    { id: 2, age: 50, name: 'Mr a', friends: [{ id: 1, age: 25 }] },
    '[0]',
  )

  // range offset last (use at())
  // maybe add offset and limit makes this possible...
  deepEqual(
    await db.query('user', mrA).include('name', 'age', 'friends[-1].age').get(),
    { id: 2, age: 50, name: 'Mr a', friends: [{ id: 1, age: 25 }] },
    '[0]',
  )
})
