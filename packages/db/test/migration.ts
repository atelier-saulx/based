import { NonStrictSchema } from '@based/schema'
import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'

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
      person: {
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
    db.create('person', {
      email: 'person' + i + '@example.com',
    })
  }

  await db.drain()

  const hooksThatShouldBeIgnoredByMigration = {
    create() {
      return {
        name: 'disaster',
      }
    },
    read() {
      return {
        name: 'its a secret',
      }
    },
  }

  const schemas: NonStrictSchema[] = [
    {
      version: '2.0.0',
      types: {
        user: {
          props: {
            fullName: 'string',
            age: 'uint8',
            email: 'string',
          },
          hooks: hooksThatShouldBeIgnoredByMigration,
        },
        person: {
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
          props: {
            name: 'string',
            age: 'uint8',
            email: 'string',
          },
          hooks: hooksThatShouldBeIgnoredByMigration,
        },
        person: {
          email: 'string',
          emailPrimary: 'string',
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
        {
          version: '<3',
          migrate: {
            person({ email, ...rest }) {
              return {
                emailPrimary: email,
                email,
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

  const users = await db.query('user').get().toObject()
  const people = await db.query('person').get().toObject()

  equal(users.length, 10)
  equal(people.length, 10)

  deepEqual(users, [
    {
      id: 1,
      age: 29,
      name: 'John9 Doe9',
      email: 'johndoe9@example.com',
    },
    {
      id: 2,
      age: 28,
      name: 'John8 Doe8',
      email: 'johndoe8@example.com',
    },
    {
      id: 3,
      age: 27,
      name: 'John7 Doe7',
      email: 'johndoe7@example.com',
    },
    {
      id: 4,
      age: 26,
      name: 'John6 Doe6',
      email: 'johndoe6@example.com',
    },
    {
      id: 5,
      age: 25,
      name: 'John5 Doe5',
      email: 'johndoe5@example.com',
    },
    {
      id: 6,
      age: 24,
      name: 'John4 Doe4',
      email: 'johndoe4@example.com',
    },
    {
      id: 7,
      age: 23,
      name: 'John3 Doe3',
      email: 'johndoe3@example.com',
    },
    {
      id: 8,
      age: 22,
      name: 'John2 Doe2',
      email: 'johndoe2@example.com',
    },
    {
      id: 9,
      age: 21,
      name: 'John1 Doe1',
      email: 'johndoe1@example.com',
    },
    {
      id: 10,
      age: 20,
      name: 'John0 Doe0',
      email: 'johndoe0@example.com',
    },
  ])

  deepEqual(people, [
    {
      id: 1,
      email: 'person9@example.com',
      emailPrimary: 'person9@example.com',
    },
    {
      id: 2,
      email: 'person8@example.com',
      emailPrimary: 'person8@example.com',
    },
    {
      id: 3,
      email: 'person7@example.com',
      emailPrimary: 'person7@example.com',
    },
    {
      id: 4,
      email: 'person6@example.com',
      emailPrimary: 'person6@example.com',
    },
    {
      id: 5,
      email: 'person5@example.com',
      emailPrimary: 'person5@example.com',
    },
    {
      id: 6,
      email: 'person4@example.com',
      emailPrimary: 'person4@example.com',
    },
    {
      id: 7,
      email: 'person3@example.com',
      emailPrimary: 'person3@example.com',
    },
    {
      id: 8,
      email: 'person2@example.com',
      emailPrimary: 'person2@example.com',
    },
    {
      id: 9,
      email: 'person1@example.com',
      emailPrimary: 'person1@example.com',
    },
    {
      id: 10,
      email: 'person0@example.com',
      emailPrimary: 'person0@example.com',
    },
  ])
})
