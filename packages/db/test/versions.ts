import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('versions', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
    types: {
      show: {
        name: 'string',
      },
      edition: {
        name: 'string',
        show: {
          ref: 'show',
          prop: 'editions',
        },
      },
      sequence: {
        name: 'string',
        edition: {
          ref: 'edition',
          prop: 'sequences',
        },
      },
      page: {
        name: 'string',
        sequence: {
          ref: 'edition',
          prop: 'pages',
        },
      },
      item: {
        name: 'string',
        page: {
          ref: 'page',
          prop: 'items',
        },
      },
    },
  })

  const user1 = db.create('user', {
    name: 'youzi',
  })

  db.create('session', {
    name: 'youzi session',
    user: user1,
  })

  await db.drain()

  db.remove('user', user1)

  await db.drain()

  deepEqual(await db.query('session').get().toObject(), [])
  deepEqual(await db.query('user').get().toObject(), [])
})
