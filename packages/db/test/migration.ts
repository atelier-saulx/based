import { BasedDb } from '../src/index.js'
import { deepEqual } from './shared/assert.js'
import test from './shared/test.js'

await test('migration', async (t) => {
  const amount = 100
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          name: { type: 'string' },
          age: { type: 'uint32' },
          meta: {
            props: {
              rating: {
                type: 'uint8',
              },
            },
          },
          friends: {
            items: {
              ref: 'user',
              prop: 'friends',
              $refUser: { ref: 'user' },
              $number: 'number',
            },
          },
        },
      },
    },
  })

  let i = 0
  let prevId
  while (true) {
    const data: any = {
      name: 'user ' + ++i,
      age: i % 100,
    }
    if (prevId) {
      data.friends = { update: [{ id: prevId, $refUser: prevId, $number: i }] }
    }
    prevId = db.create('user', data)
    if (i === amount) {
      break
    }
  }

  await db.drain()

  let allUsers = await db
    .query('user')
    .range(0, amount + 1000)
    .include('friends.$refUser.id', 'friends.$number')
    .get()
    .toObject()
  const allFriends = allUsers.map(({ friends }) => friends).flat()

  const nameToEmail = (name: string) => name.replace(/ /g, '-') + '@gmail.com'
  let migrationPromise = db.migrateSchema(
    {
      types: {
        cmsuser: {
          props: {
            name: { type: 'string' },
            email: { type: 'string' },
            age: { type: 'uint8' },
            bestBud: {
              ref: 'cmsuser',
              prop: 'bestBudOf',
            },
            buddies: {
              items: {
                ref: 'cmsuser',
                prop: 'buddies',
                $refUser: { ref: 'cmsuser' },
                $number: 'number',
              },
            },
          },
        },
      },
    },
    {
      user(node) {
        node.email = node.name.replace(/ /g, '-') + '@gmail.com'
        node.buddies = node.friends
        node.bestBud = node.friends[0]
        return ['cmsuser', node]
      },
    },
  )

  await migrationPromise

  allUsers = (
    await db
      .query('cmsuser')
      .include('*', 'buddies.$refUser.id', 'buddies.$number')
      .range(0, amount + 1000)
      .get()
  ).toObject()

  const allBuddies = allUsers.map(({ buddies }) => buddies).flat()

  deepEqual(allBuddies, allFriends)

  if (
    allUsers.every((node) => {
      return (
        node.email === nameToEmail(node.name) && typeof node.age === 'number'
      )
    })
  ) {
    // --------
  } else {
    throw 'Missing email from migration'
  }
})
