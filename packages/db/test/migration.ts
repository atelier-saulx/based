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

  let i = 0
  while (true) {
    db.create('user', {
      name: 'user ' + ++i,
    })
    if (i === 5_000_000) {
      break
    }
  }

  db.drain()

  let allUsers = (await db.query('user').range(0, 5_000_000).get()).toObject()

  const nameToEmail = (name: string) => name.replace(/ /g, '-') + '@gmail.com'
  const migrationPromise = db.migrateSchema(
    {
      types: {
        user: {
          props: {
            name: { type: 'string' },
            email: { type: 'string' },
          },
        },
      },
    },
    (type, node) => {
      if (type === 'user') {
        node = { ...node }
        node.email = node.name.replace(/ /g, '-') + '@gmail.com'
        return node
      }
    },
  )

  db.create('user', {
    name: 'newuser',
  })

  db.update('user', 1, {
    name: 'change1',
  })

  await setTimeout(500)

  db.create('user', {
    name: 'newuser2',
  })

  await db.update('user', 1, {
    name: 'change2',
  })

  await setTimeout(500)

  db.create('user', {
    name: 'newuser3',
  })

  await db.update('user', 1, {
    name: 'change3',
  })

  await migrationPromise

  allUsers = (await db.query('user').range(0, 6_000_000).get()).toObject()
  console.log(allUsers[0], allUsers.at(-1))

  if (
    allUsers.every((node) => {
      if (!node.name) {
        console.log(node)
      }
      return node.email === nameToEmail(node.name)
    })
  ) {
    console.log('success')
  } else {
    throw 'Missing email from migration'
  }
})
