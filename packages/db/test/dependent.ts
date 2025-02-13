import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'
import { italy } from './shared/examples.js'

await test('dependent', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
    types: {
      session: {
        props: {
          name: 'string',
          user: {
            ref: 'user',
            prop: 'sessions',
            dependent: true,
          },
        },
      },
      user: {
        props: {
          name: 'string',
          sessions: {
            items: {
              ref: 'session',
              prop: 'user',
            },
          },
        },
      },
    },
  })

  const user1 = db.create('user', {
    name: 'youzi',
  })

  const session1 = db.create('session', {
    name: 'youzi session',
    user: user1,
  })

  await db.drain()

  console.log(
    '--->',
    await db.query('session').include('*', 'user').get().toObject(),
  )

  db.remove('user', user1)
  await db.drain()

  console.log(
    '--->',
    await db.query('session').include('*', 'user').get().toObject(),
  )
})
