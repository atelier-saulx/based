import { deepEqual } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('mixed props', async (t) => {
  const db = await testDb(t, {
    types: {
      user: {
        props: {
          name: { type: 'string' },
          email: { type: 'string' },
          age: { type: 'uint32' },
          story: { type: 'string' },
          alias: { type: 'alias' },
        },
      },
      typeTest: {
        props: {
          q: { type: 'reference', ref: 'user', prop: 'test' },
          r: { type: 'enum', enum: ['a', 'b', 'c'] },
        },
      },
    },
  })

  const u = await db.create('user', {
    name: 'T',
    email: 't@t.com',
    age: 33,
    story: 'hello',
    alias: 't',
  })

  const t1 = await db.create('typeTest', {
    q: u,
    r: 'a',
  })

  const typeTest = await db
    .query('typeTest')
    .include('*', '**')
    .get()
    .toObject()
  const user = await db.query('user').include('*', '**').get().toObject()

  deepEqual(typeTest, [
    {
      id: 1,
      r: 'a',
      q: {
        id: 1,
        age: 33,
        name: 'T',
        email: 't@t.com',
        story: 'hello',
        alias: 't',
      },
    },
  ])

  deepEqual(user, [
    {
      id: 1,
      age: 33,
      name: 'T',
      email: 't@t.com',
      story: 'hello',
      alias: 't',
      test: [{ id: 1, r: 'a' }],
    },
  ])
})
