import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, throws } from './shared/assert.js'

await test('hooks - undefined values', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        hooks: {
          create(payload) {
            payload.defined ??= {}
            payload.defined.age = typeof payload.age === 'number'
          },
          update(payload) {
            payload.defined ??= {}
            payload.defined.age = typeof payload.age === 'number'
          },
          read(result) {
            if ('defined' in result) {
              for (const i in result.defined) {
                if (result.defined[i] === false) {
                  result[i] = undefined
                }
              }
              delete result.defined
            }
          },
          include(query, fields) {
            if (fields.has('age')) {
              query.include('defined.age')
            }
          },
          filter(query, field, operator, value) {
            if (field === 'age') {
              query.filter('defined.age')
            }
          },
        },
        props: {
          name: 'string',
          age: 'uint8',
          defined: {
            props: {
              age: 'boolean',
            },
          },
        },
      },
    },
  })

  await db.create('user', {
    name: 'youzi',
  })

  await db.create('user', {
    name: 'james',
    age: 25,
  })

  deepEqual(await db.query('user').get(), [
    {
      id: 1,
      name: 'youzi',
      age: undefined,
    },
    {
      id: 2,
      name: 'james',
      age: 25,
    },
  ])

  deepEqual(await db.query('user').filter('age', '<', 50).get(), [
    {
      id: 2,
      name: 'james',
      age: 25,
    },
  ])

  await db.update('user', 1, {
    age: 31,
  })

  deepEqual(await db.query('user').get(), [
    {
      id: 1,
      name: 'youzi',
      age: 31,
    },
    {
      id: 2,
      name: 'james',
      age: 25,
    },
  ])

  deepEqual(await db.query('user').filter('age', '<', 50).get(), [
    {
      id: 1,
      name: 'youzi',
      age: 31,
    },
    {
      id: 2,
      name: 'james',
      age: 25,
    },
  ])
})

await test('hooks - private nodes', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        hooks: {
          read(result) {
            if (result.private) {
              return {
                id: result.id,
                private: true,
              }
            }
          },
          include(query) {
            query.include('private')
          },
        },
        props: {
          name: 'string',
          age: 'uint8',
          private: 'boolean',
        },
      },
    },
  })

  await db.create('user', {
    name: 'youzi',
    private: true,
  })

  await db.create('user', {
    name: 'james',
    age: 25,
  })

  deepEqual(await db.query('user').get(), [
    {
      id: 1,
      private: true,
    },
    {
      id: 2,
      name: 'james',
      age: 25,
      private: false,
    },
  ])

  await db.update('user', 1, {
    age: 31,
    private: false,
  })

  deepEqual(await db.query('user').get(), [
    {
      id: 1,
      name: 'youzi',
      age: 31,
      private: false,
    },
    {
      id: 2,
      name: 'james',
      age: 25,
      private: false,
    },
  ])
})

await test('hooks - as SQL CHECK constraints', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        hooks: {
          create(payload) {
            if (payload.age < 21 && payload.city === 'Sandcity') {
              throw new Error('Minors not allowed in Sandcity')
            }
          },
        },
        props: {
          name: 'string',
          age: 'uint8',
          city: 'string',
        },
      },
    },
  })

  throws(() =>
    db.create('user', {
      name: '',
      age: 15,
      city: 'Sandcity',
    }),
  )

  deepEqual((await db.query('user').get()).length, 0)
})

await test('property modify hooks', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          name: 'string',
          age: 'uint8',
          city: {
            type: 'string',
            hooks: {
              create(value, payload) {
                if (payload.age < 21 && value === 'Sandcity') {
                  throw new Error('Minors not allowed in Sandcity')
                }
                return 'Snurko'
              },
              update(value) {
                if (value?.toLowerCase() === 'ignore') {
                  return undefined
                }
                return 'Success'
              },
            },
          },
        },
      },
    },
  })

  throws(() =>
    db.create('user', {
      name: '',
      age: 15,
      city: 'Sandcity',
    }),
  )

  const youzi = await db.create('user', {
    name: 'youzi',
    age: 21,
    city: 'wut',
  })

  deepEqual(await db.query('user').get(), [
    { id: 1, age: 21, name: 'youzi', city: 'Snurko' },
  ])

  await db.update('user', youzi, {
    city: 'Fail',
  })

  deepEqual(await db.query('user').get(), [
    { id: 1, age: 21, name: 'youzi', city: 'Success' },
  ])

  await db.update('user', youzi, {
    city: 'ignore',
  })

  deepEqual(await db.query('user').get(), [
    { id: 1, age: 21, name: 'youzi', city: 'Success' },
  ])
})

await test('property read hooks', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          name: 'string',
          age: 'uint8',
          city: {
            type: 'string',
            hooks: {
              read(value, result) {
                return 'Amsterdam'
              },
            },
          },
        },
      },
    },
  })

  await db.create('user', {
    name: 'youzi',
    age: 21,
    city: 'wut',
  })

  deepEqual(await db.query('user').get(), [
    { id: 1, age: 21, name: 'youzi', city: 'Amsterdam' },
  ])
})
