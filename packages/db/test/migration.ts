import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
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
          age: { type: 'uint32' },
        },
      },
    },
  })

  let i = 0
  while (true) {
    db.create('user', {
      name: 'user ' + ++i,
      age: i % 100,
    })
    if (i === 5_000_000) {
      break
    }
  }

  db.drain()

  let allUsers = (await db.query('user').range(0, 5_000_000).get()).toObject()

  const nameToEmail = (name: string) => name.replace(/ /g, '-') + '@gmail.com'
  let migrationPromise = db.migrateSchema(
    {
      types: {
        cmsuser: {
          props: {
            name: { type: 'string' },
            email: { type: 'string' },
            age: { type: 'uint8' },
          },
        },
      },
    },
    {
      user(node) {
        node.email = node.name.replace(/ /g, '-') + '@gmail.com'
        return ['cmsuser', node]
      },
    },
  )

  console.time('migration time')
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
  console.timeEnd('migration time')

  console.log('???')

  allUsers = (await db.query('cmsuser').range(0, 6_000_000).get()).toObject()

  console.log(allUsers[0], allUsers.at(-1))

  if (
    allUsers.every((node) => {
      return (
        node.email === nameToEmail(node.name) && typeof node.age === 'number'
      )
    })
  ) {
    console.log('success')
  } else {
    throw 'Missing email from migration'
  }
})
