import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('exists', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
    types: {
      user: {
        props: {
          name: 'string',
          friend: {
            ref: 'user',
            prop: 'friend',
          },
        },
      },
    },
  })

  const id1 = await db.create('user', {
    name: 'mr derp',
  })

  const id2 = await db.create('user', {})

  await db.query('user').get().inspect(10)

  deepEqual(await db.query('user').filter('name', 'exists').get().toObject(), [
    {
      id: 1,
      name: 'mr derp',
    },
  ])

  deepEqual(await db.query('user').filter('name', '!exists').get().toObject(), [
    {
      id: 2,
      name: '',
    },
  ])

  // exists
})
