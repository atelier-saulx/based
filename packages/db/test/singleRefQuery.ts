import { fileURLToPath } from 'url'
import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('single reference query', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

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
        },
      },
      blup: {
        fields: {
          age: { type: 'integer' },
          name: { type: 'string' },
          user: {
            type: 'reference',
            allowedType: 'user',
            inverseProperty: 'myBlup',
          },
          simple: {
            type: 'reference',
            allowedType: 'simple',
            inverseProperty: 'lilBlup',
          },
          // @ts-ignore
          flap: { type: 'string', maxBytes: 1 },
        },
      },
      simple: {
        fields: {
          smurp: { type: 'integer' },
          user: {
            type: 'reference',
            allowedType: 'user',
            inverseProperty: 'simple',
          },
          lilBlup: {
            type: 'reference',
            allowedType: 'blup',
            inverseProperty: 'simple',
          },
          flap: {
            type: 'object',
            properties: {
              power: { type: 'integer' },
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

  db.drain()

  const result2 = db.query('simple').filter('user.myBlup.age', '=', 10).get()

  deepEqual(result2.toObject(), [
    {
      id: 1,
      smurp: 0,
      flap: {
        power: 10,
      },
    },
  ])

  const result = db
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
