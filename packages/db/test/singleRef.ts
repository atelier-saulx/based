import { fileURLToPath } from 'url'
import fs from 'node:fs/promises'
import { BasedDb } from '../src/index.js'
import { join, dirname, resolve } from 'path'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'

const __dirname = dirname(fileURLToPath(import.meta.url).replace('/dist/', '/'))
const relativePath = '../tmp'
const dbFolder = resolve(join(__dirname, relativePath))

await test('single simple', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}

  const db = new BasedDb({
    path: dbFolder,
  })

  await db.start()

  t.after(() => {
    return db.destroy()
  })

  db.updateSchema({
    types: {
      user: {
        fields: {
          bla: { type: 'integer' },
          simple: {
            type: 'reference',
            allowedType: 'simple',
            inverseProperty: 'user',
          },
          name: { type: 'string' },
        },
      },
      simple: {
        fields: {
          bla: { type: 'integer' },
          user: {
            type: 'reference',
            allowedType: 'user',
            inverseProperty: 'simple',
          },
        },
      },
    },
  })

  db.create('simple', {
    user: db.create('user', {
      name: 'Mr snurp',
    }),
  })

  db.drain()

  deepEqual(db.query('simple').include('user.name').get().toObject(), [
    {
      id: 1,
      user: {
        id: 1,
        name: 'Mr snurp',
      },
    },
  ])
})

await test('simple nested', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}

  const db = new BasedDb({
    path: dbFolder,
  })

  await db.start()

  t.after(() => {
    return db.destroy()
  })

  db.updateSchema({
    types: {
      user: {
        fields: {
          myBlup: {
            type: 'reference',
            allowedType: 'blup',
            inverseProperty: 'user',
          },
          simple: {
            type: 'reference',
            allowedType: 'simple',
            inverseProperty: 'user',
          },
        },
      },
      blup: {
        fields: {
          // @ts-ignore
          flap: { type: 'string', maxBytes: 1 },
          user: {
            type: 'reference',
            allowedType: 'user',
            inverseProperty: 'myBlup',
          },
        },
      },
      simple: {
        fields: {
          user: {
            type: 'reference',
            allowedType: 'user',
            inverseProperty: 'simple',
          },
        },
      },
    },
  })

  const simple = db.create('simple', {
    user: db.create('user', {
      myBlup: db.create('blup', {
        flap: 'B',
      }),
    }),
  })

  db.drain()

  deepEqual(db.query('blup').include('flap').get().toObject(), [
    {
      id: 1,
      flap: 'B',
    },
  ])

  const result1 = db.query('user').include('myBlup.flap').get()

  for (const r of result1) {
    equal(r.myBlup.flap, 'B')
  }

  const result = db.query('simple').include('user.myBlup.flap').get()

  for (const r of result) {
    equal(r.user.myBlup.flap, 'B')
  }

  db.update('simple', simple, {
    user: null,
  })

  db.drain()

  deepEqual(db.query('simple').include('user').get().toObject(), [
    {
      id: 1,
      user: null,
    },
  ])
})

await test('single reference object', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}

  const db = new BasedDb({
    path: dbFolder,
  })

  await db.start()

  t.after(() => {
    return db.destroy()
  })

  db.updateSchema({
    types: {
      user: {
        fields: {
          myBlup: { type: 'reference', allowedType: 'blup' },
        },
      },
      blup: {
        fields: {
          // @ts-ignore
          flap: { type: 'string', maxBytes: 1 },
        },
      },
      simple: {
        fields: {
          user: { type: 'reference', allowedType: 'user' },
          admin: {
            type: 'object',
            properties: {
              role: { type: 'string' },
              user: { type: 'reference', allowedType: 'user' },
            },
          },
        },
      },
    },
  })

  db.create('simple', {
    admin: {
      user: db.create('user', {
        myBlup: db.create('blup', {
          flap: 'B',
        }),
      }),
    },
  })

  db.drain()

  deepEqual(db.query('simple').include('admin.user').get().toObject(), [
    {
      id: 1,
      admin: {
        user: {
          id: 1,
        },
      },
    },
  ])
})

await test('nested', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}

  const db = new BasedDb({
    path: dbFolder,
  })

  await db.start()

  t.after(() => {
    return db.destroy()
  })

  db.updateSchema({
    types: {
      user: {
        fields: {
          myBlup: {
            type: 'reference',
            allowedType: 'blup',
            inverseProperty: 'user',
          },
          simple: {
            type: 'reference',
            allowedType: 'simple',
            inverseProperty: 'user',
          },
          name: { type: 'string' },
          flap: { type: 'integer' },
          email: { type: 'string', maxLength: 15 },
          age: { type: 'integer' }, // Add receiving field
          snurp: { type: 'string' },
          burp: { type: 'integer' },
          location: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              x: { type: 'integer' },
              y: { type: 'integer' },
            },
          },
        },
      },
      blup: {
        fields: {
          // @ts-ignore
          flap: { type: 'string', maxBytes: 1 },
          name: { type: 'string' },
          user: {
            type: 'reference',
            allowedType: 'user',
            inverseProperty: 'myBlup',
          },
          simple: {
            type: 'reference',
            allowedType: 'simple',
            inverseProperty: 'user',
          },
        },
      },
      simple: {
        fields: {
          // @ts-ignore
          countryCode: { type: 'string', maxBytes: 2 },
          lilBlup: {
            type: 'reference',
            allowedType: 'blup',
            inverseProperty: 'simple',
          },
          vectorClock: { type: 'integer' },
          user: {
            type: 'reference',
            allowedType: 'user',
            inverseProperty: 'simple',
          },
        },
      },
    },
  })

  const blup = db.create('blup', {
    name: 'blup !',
    flap: 'A',
  })

  const user = db.create('user', {
    myBlup: blup,
    age: 99,
    name: 'Jim de Beer',
    email: 'person@once.net',
    flap: 10,
    location: {
      label: 'BLA BLA',
      x: 1,
      y: 2,
    },
  })

  const amount = 1e5

  for (let i = 0; i < amount; i++) {
    db.create('simple', {
      user,
      vectorClock: i,
      countryCode: 'aa',
      lilBlup: blup,
    })
  }

  db.drain()

  deepEqual(db.query('simple').include('id').range(0, 1).get().toObject(), [
    { id: 1 },
  ])

  deepEqual(db.query('simple').include('user').range(0, 1).get().toObject(), [
    {
      id: 1,
      user: {
        id: 1,
        name: 'Jim de Beer',
        flap: 10,
        email: 'person@once.net',
        age: 99,
        snurp: '',
        burp: 0,
        location: { label: 'BLA BLA', x: 1, y: 2 },
      },
    },
  ])

  deepEqual(
    db.query('simple').include('user.myBlup').range(0, 1).get().toObject(),
    [{ id: 1, user: { id: 1, myBlup: { id: 1, flap: 'A', name: 'blup !' } } }],
    'get userMyBlup',
  )

  deepEqual(
    db
      .query('simple')
      .include('user.myBlup', 'lilBlup')
      .range(0, 1)
      .get()
      .toObject(),
    [
      {
        id: 1,
        user: { id: 1, myBlup: { id: 1, flap: 'A', name: 'blup !' } },
        lilBlup: { id: 1, flap: 'A', name: 'blup !' },
      },
    ],
  )

  equal(
    db.query('simple').include('user.myBlup').get().node().user.myBlup.flap,
    'A',
    'Read nested field with getter',
  )

  deepEqual(
    db
      .query('simple')
      .include('user.myBlup', 'lilBlup', 'user.name')
      .range(0, 1)
      .get()
      .toObject(),
    [
      {
        id: 1,
        user: {
          id: 1,
          myBlup: { id: 1, flap: 'A', name: 'blup !' },
          name: 'Jim de Beer',
        },
        lilBlup: { id: 1, flap: 'A', name: 'blup !' },
      },
    ],
  )

  deepEqual(
    db
      .query('simple')
      .include('user.location.label')
      .range(0, 1)
      .get()
      .toObject(),
    [{ id: 1, user: { id: 1, location: { label: 'BLA BLA' } } }],
  )

  deepEqual(
    db.query('simple').include('user.location').range(0, 1).get().toObject(),
    [{ id: 1, user: { id: 1, location: { label: 'BLA BLA', x: 1, y: 2 } } }],
  )

  deepEqual(
    db
      .query('simple')
      .include('user.myBlup', 'lilBlup')
      .range(0, 1)
      .get()
      .toObject(),
    [
      {
        id: 1,
        user: {
          id: 1,
          myBlup: {
            id: 1,
            flap: 'A',
            name: 'blup !',
          },
        },
        lilBlup: {
          id: 1,
          flap: 'A',
          name: 'blup !',
        },
      },
    ],
  )

  deepEqual(
    db
      .query('simple')
      .include('user', 'user.myBlup')
      .range(0, 1)
      .get()
      .toObject(),
    [
      {
        id: 1,
        user: {
          id: 1,
          name: 'Jim de Beer',
          flap: 10,
          email: 'person@once.net',
          age: 99,
          snurp: '',
          burp: 0,
          location: { label: 'BLA BLA', x: 1, y: 2 },
          myBlup: { id: 1, flap: 'A', name: 'blup !' },
        },
      },
    ],
  )

  deepEqual(
    db
      .query('simple')
      .include('user', 'user.myBlup', 'lilBlup')
      .range(0, 1)
      .get()
      .toObject(),
    [
      {
        id: 1,
        user: {
          id: 1,
          myBlup: { id: 1, flap: 'A', name: 'blup !' },
          name: 'Jim de Beer',
          flap: 10,
          email: 'person@once.net',
          age: 99,
          snurp: '',
          burp: 0,
          location: { label: 'BLA BLA', x: 1, y: 2 },
        },
        lilBlup: { id: 1, flap: 'A', name: 'blup !' },
      },
    ],
  )
})

await test('single reference multi refs strings', async (t) => {
  try {
    await fs.rm(dbFolder, { recursive: true })
  } catch (err) {}

  await fs.mkdir(dbFolder)

  const db = new BasedDb({
    path: dbFolder,
  })

  await db.start()

  t.after(() => {
    return db.destroy()
  })

  db.updateSchema({
    types: {
      user: {
        fields: {
          name: { type: 'string' },
          myBlup: { type: 'reference', allowedType: 'blup' },
        },
      },
      blup: {
        fields: {
          name: { type: 'string' },
          // @ts-ignore
          flap: { type: 'string', maxBytes: 1 },
        },
      },
      simple: {
        fields: {
          age: { type: 'integer' },
          lilBlup: { type: 'reference', allowedType: 'blup' },
          user: { type: 'reference', allowedType: 'user' },
        },
      },
    },
  })

  const blup = db.create('blup', {
    flap: 'B',
  })

  db.create('simple', {
    user: db.create('user', {
      name: 'mr snurp',
      myBlup: blup,
    }),
    lilBlup: blup,
  })

  db.drain()

  const result = db
    .query('simple')
    .include('user', 'user.myBlup', 'lilBlup')
    .get()

  for (const r of result) {
    equal(r.lilBlup.name, '')
  }

  db.create('simple', {
    age: 5,
  })

  db.drain()

  const result2 = db
    .query('simple')
    .filter('age', '=', 5)
    .include('user', 'user.myBlup', 'lilBlup')
    .get()

  deepEqual(result2.toObject(), [
    {
      id: 2,
      user: null,
      lilBlup: null,
    },
  ])
})
