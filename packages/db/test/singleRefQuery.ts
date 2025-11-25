import { deepEqual } from './shared/assert.js'
import { BasedDb } from '../src/db.js'
import test from './shared/test.js'

await test('single reference query', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          myBlup: {
            ref: 'blup',
            prop: 'user',
          },
          simple: {
            ref: 'simple',
            prop: 'user',
          },
          name: { type: 'string' },
        },
      },
      blup: {
        props: {
          age: { type: 'uint32' },
          name: { type: 'string' },
          user: {
            ref: 'user',
            prop: 'myBlup',
          },
          simple: {
            ref: 'simple',
            prop: 'lilBlup',
          },
          // @ts-ignore
          flap: { type: 'string', maxBytes: 1 },
        },
      },
      simple: {
        props: {
          smurp: { type: 'uint32' },
          user: {
            ref: 'user',
            prop: 'simple',
          },
          lilBlup: {
            ref: 'blup',
            prop: 'simple',
          },
          flap: {
            props: {
              power: { type: 'uint32' },
            },
          },
        },
      },
    },
  })

  const blup = db.create('blup', {
    flap: 'B',
    age: 10,
    name: 'mr blup',
  })

  const differentBlup = db.create('blup', {
    flap: 'C',
    age: 20,
    name: 'mr blup 2',
  })

  const user = db.create('user', {
    myBlup: blup,
  })

  const user2 = db.create('user', {
    myBlup: differentBlup,
  })

  db.create('simple', {
    flap: {
      power: 10,
    },
    user,
  })

  db.create('simple', {
    lilBlup: blup,
    user: user2,
  })

  db.create('simple', {
    lilBlup: blup,
    flap: {
      power: 10,
    },
  })

  db.create('simple', {
    lilBlup: differentBlup,
    flap: {
      power: 10,
    },
  })

  await db.drain()

  const result2 = await db
    .query('simple')
    .filter('user.myBlup.age', '=', 10)
    .get()

  deepEqual(result2.toObject(), [
    {
      id: 1,
      smurp: 0,
      flap: {
        power: 10,
      },
    },
  ])

  const result = await db
    .query('simple')
    .filter('lilBlup.age', '=', 20)
    .filter('flap.power', '=', 10)
    .include('lilBlup', 'flap')
    .get()

  deepEqual(result.toObject(), [
    {
      id: 4,
      lilBlup: {
        id: 2,
        age: 20,
        name: 'mr blup 2',
        flap: 'C',
      },
      flap: {
        power: 10,
      },
    },
  ])
})
