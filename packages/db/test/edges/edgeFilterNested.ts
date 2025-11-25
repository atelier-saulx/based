import { deepEqual } from '../shared/assert.js'
import { BasedDb } from '../../src/db.js'
import test from '../shared/test.js'

await test('edge enum', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      initiative: {
        name: 'string',
        users: {
          items: {
            ref: 'user',
            prop: 'initiatives',
            $role: ['a', 'b'],
          },
        },
      },
      user: {
        name: 'string',
        initiatives: {
          items: {
            ref: 'initiative',
            prop: 'users',
            // $role: ['a', 'b'],
          },
        },
      },
    },
  })

  const userX = await db.create('user', { name: 'mr x' })
  const userY = await db.create('user', { name: 'mr y' })

  await db.create('initiative', {
    name: 'powerfull initiative',
    users: [
      { id: userX, $role: 'a' },
      { id: userY, $role: 'b' },
    ],
  })

  deepEqual(
    await db
      .query('user')
      .include('name', (q) => {
        q('initiatives').filter('$role', '=', 'a').include('name')
      })
      .get(),
    [
      {
        id: 1,
        name: 'mr x',
        initiatives: [{ id: 1, name: 'powerfull initiative' }],
      },
      { id: 2, name: 'mr y', initiatives: [] },
    ],
  )

  deepEqual(
    await db
      .query('user')
      .include('name', (q) => {
        q('initiatives')
          .filter('$role', '=', 'a')
          .include((q) => q('users').include('$role').filter('$role', '=', 'b'))
      })
      .get(),
    [
      {
        id: 1,
        name: 'mr x',
        initiatives: [{ id: 1, users: [{ id: 2, $role: 'b' }] }],
      },
      { id: 2, name: 'mr y', initiatives: [] },
    ],
  )
})
