import { BasedDb } from '../src/index.js'
import { deepEqual } from './shared/assert.js'
import test from './shared/test.js'

await test('migration', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        firstName: 'string',
        lastName: 'string',
        email: 'string',
        age: 'number',
      },
    },
  })

  let i = 10
  while (i--) {
    db.create('user', {
      firstName: 'John' + i,
      lastName: 'Doe' + i,
      email: 'johndoe' + i + '@example.com',
      age: i + 20,
    })
  }

  await db.drain()

  const before = await db.query('user').get().toObject()

  const transformFns = {
    user({ firstName, lastName, ...rest }) {
      return {
        name: `${firstName} ${lastName}`,
        ...rest,
      }
    },
  }

  await db.setSchema(
    {
      types: {
        user: {
          name: 'string',
          email: 'string',
          age: 'number',
        },
      },
    },
    transformFns,
  )

  const after = await db.query('user').get().toObject()

  deepEqual(before.map(transformFns.user), after)
})
