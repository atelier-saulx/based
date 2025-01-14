import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'
import { euobserver } from './shared/examples.js'
import { setTimeout } from 'node:timers/promises'
await test('migration', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.putSchema({
    types: {
      user: {
        props: {
          name: { type: 'string' },
        },
      },
    },
  })

  let i = 5_000_000
  while (i--) {
    db.create('user', {
      name: 'user ' + i,
    })
  }

  const migrationPromise = db.migrateSchema(
    {
      types: {
        user: {
          props: {
            email: { type: 'string' },
          },
        },
      },
    },
    (type, node) => {
      if (type === 'user') {
        node.email = node.name.replace(/ /g, '-') + '@gmail.com'
        return node
      }
    },
  )

  db.create('user', {
    name: 'newuser',
  })

  await setTimeout(500)

  db.create('user', {
    name: 'newuser2',
  })

  await setTimeout(500)

  db.create('user', {
    name: 'newuser3',
  })

  await setTimeout(500)

  db.create('user', {
    name: 'newuser4',
  })

  await setTimeout(500)

  db.create('user', {
    name: 'newuser5',
  })

  await migrationPromise

  const allUsers = (await db.query('user').get()).toObject()

  if (allUsers.every(({ email }) => !!email)) {
    console.log('success')
  } else {
    throw 'Missing email from migration'
  }
})
