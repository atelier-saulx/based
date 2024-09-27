import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('references modify', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  t.after(() => {
    return db.destroy()
  })

  await db.start({ clean: true })

  db.putSchema({
    types: {
      user: {
        props: {
          name: 'string',
          friends: {
            items: {
              ref: 'friend',
              prop: 'users',
            },
          },
        },
      },
      friend: {
        props: {
          name: 'string',
          users: {
            ref: 'user',
            prop: 'friends',
          },
        },
      },
    },
  })

  const a = await db.create('friend', {
    name: 'youzi',
  })

  console.log({ a })

  const b = await db.create('user', {
    name: 'jamex',
    friends: [a],
  })

  console.log({ b })
})
