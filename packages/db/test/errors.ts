import { BasedDb } from '../src/index.js'
import { equal } from './shared/assert.js'
import test from './shared/test.js'

await test('handle errors', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        friends: {
          items: {
            ref: 'user',
            prop: 'friends',
          },
        },
      },
    },
  })

  await db.create('user', {
    friends: [2],
  })

  equal(await db.query('user').include('friends').get(), [
    {
      friends: [],
    },
  ])

  // await db.update('user', 2, {
  //   friends: [2],
  // })
})
