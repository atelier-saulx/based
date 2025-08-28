import { NonStrictSchema } from '@based/schema'
import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { equal } from './shared/assert.js'

await test('migration', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    version: '1.0.0',
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
          version: '2',
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
    await db.setSchema(schema)
  }

  const res = await db.query('user').get().toObject()
  equal(res.length, 10)
})
