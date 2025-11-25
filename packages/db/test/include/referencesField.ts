import test from '../shared/test.js'
import { BasedDb } from '../../src/db.js'
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
          age: 'uint32',
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

  for (let i = 0; i < 1e5; i++) {
    db.create('user', { name: 'Mr ' + i, age: 92 + i, friends: [mrA] })
  }

  deepEqual(
    await db.query('user', mrA).include('name', 'age', 'friends[0].age').get(),
    { id: 2, age: 50, name: 'Mr a', friends: [{ id: 1, age: 25 }] },
    '[0]',
  )

  deepEqual(
    await db.query('user').at(0).get(),
    { id: 1, age: 25, name: 'Mr b' },
    '.at(0)',
  )

  deepEqual(
    await db.query('user').at(3).get(),
    { id: 4, age: 93, name: 'Mr 1' },
    '.at(3)',
  )

  // await db.query('user').range(-10, -1).get().inspect()

  // deepEqual(
  //   await db.query('user').range(-10, -1).get(),
  //   { id: 4, age: 93, name: 'Mr 1' },
  //   '.at(3)',
  // )
})
