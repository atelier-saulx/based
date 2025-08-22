import { NonStrictSchema } from '@based/schema'
import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

await test('migration', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    // version: '1.0.0',
    types: {
      user: {
        firstName: 'string',
        lastName: 'string',
        age: 'uint8',
        email: 'string',
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

  const schemas: NonStrictSchema[] = [
    {
      version: '2.0.0',
      types: {
        user: {
          fullName: 'string',
          age: 'uint8',
          email: 'string',
        },
      },
      migrations: [
        {
          version: '<2',
          migrate: {
            user({ firstName, lastName, ...rest }) {
              return {
                fullName: firstName + ' ' + lastName,
                ...rest,
              }
            },
          },
        },
      ],
    },
    {
      version: '3.0.0',
      types: {
        user: {
          name: 'string',
          age: 'uint8',
          email: 'string',
        },
      },
      migrations: [
        {
          version: '<3',
          migrate: {
            user({ fullName, ...rest }) {
              return {
                name: fullName,
                ...rest,
              }
            },
          },
        },
      ],
    },
  ]

  for (const schema of schemas) {
    // const before = await db.query('user').get().toObject()
    await db.setSchema(schema)
    // deepEqual(before.map(schema.migrations[0].user), after)
  }

  console.log('---', await db.query('user').get().toObject())

  // let i = 10
  // while (i--) {
  //   db.create('user', {
  //     firstName: 'John' + i,
  //     lastName: 'Doe' + i,
  //     email: 'johndoe' + i + '@example.com',
  //     age: i + 20,
  //   })
  // }

  // await db.drain()

  // const before = await db.query('user').get().toObject()

  // const transformFns = {
  //   user({ firstName, lastName, ...rest }) {
  //     return {
  //       name: `${firstName} ${lastName}`,
  //       ...rest,
  //     }
  //   },
  // }

  // await db.setSchema(
  //   {
  //     types: {
  //       user: {
  //         name: 'string',
  //         email: 'string',
  //         age: 'number',
  //       },
  //     },
  //   },
  //   transformFns,
  // )

  // const after = await db.query('user').get().toObject()
})
