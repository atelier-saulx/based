import { deepCopy, wait } from '@saulx/utils'
import { BasedDb } from '../src/index.js'
import { deepEqual } from './shared/assert.js'
import test from './shared/test.js'
import { Schema } from '@based/schema'

await test('many setSchema with different order props', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })

  t.after(() => t.backup(db))

  let schemas = 100
  let updating = schemas
  const schema = {
    types: {
      user: {
        props: {
          name: 'string',
          email: {
            type: 'alias',
            format: 'email',
          },
          role: ['admin', 'translator', 'viewer'],
          currentToken: 'alias',
          status: ['login', 'clear', 'invited'],
          location: 'string',
          lang: 'string',
          inactive: 'boolean',
        },
      },
    },
  }
  await db.setSchema(deepCopy(schema) as Schema)

  const userId = await db.create('user', {
    name: 'string',
    email: 'email',
    currentToken: 'currentToken',
    role: 'translator',
    status: 'clear',
    location: 'string',
    lang: 'string',
    inactive: false,
  })

  while (schemas--) {
    setTimeout(() => {
      const shuffled = {
        types: {
          user: {
            props: Object.fromEntries(
              Object.entries(schema.types.user.props).sort(() => {
                return Math.random() > 0.5 ? -1 : 1
              }),
            ),
          },
        },
      }

      db.setSchema(shuffled as Schema).then(() => {
        updating--
      })
    }, 1e3 * Math.random())
  }

  while (updating) {
    await db.update('user', userId, {
      location: Math.random() > 0.5 ? 'xxx' : null,
    })
    await wait(5)
  }

  deepEqual(await db.query('user').get(), [
    {
      id: 1,
      role: 'translator',
      status: 'clear',
      inactive: false,
      name: 'string',
      email: 'email',
      currentToken: 'currentToken',
      location: 'xxx',
      lang: 'string',
    },
  ])
})

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
          status: ['active', 'inactive'],
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
      status: i % 2 ? 'active' : 'inactive',
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
            status: { enum: ['active', 'inactive'] },
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
