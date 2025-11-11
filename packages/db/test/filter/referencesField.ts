import test from '../shared/test.js'
import { BasedDb } from '../../src/index.js'

await test('filter references shortcut', async (t) => {
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

  await db.create('user', {
    name: 'Mr a',
    age: 50,
    friends: [db.create('user', { name: 'Mr b', age: 25 })],
  })

  // await db.create('user', {
  //   name: 'Mr c',
  //   friends: [db.create('user', { name: 'Mr d', age: 99 })],
  // })

  await db
    .query('user')
    .include('name', 'age', 'friends')
    .filter('friends.age', '>', 40)
    .get()
    .inspect()
  // lets add some functionality
})
