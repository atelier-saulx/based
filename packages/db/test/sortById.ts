import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'

const schema = {
  types: {
    user: {
      name: 'string',
      derp: 'number',
    },
  },
} as const

// import { Schema} f

// type Schema = typeof schema

await test('sort by id', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return t.backup(db)
  })

  await db.setSchema(schema)

  for (let i = 0; i < 1e6; i++) {
    db.create('user', {
      name: `user ${i}`,
      derp: i,
    })
  }

  const dbTime = await db.drain()

  console.log('dbTime', dbTime)

  const result = await db.query('user').include('name').sort('id', 'desc').get()
  // []User
  const users = result.toObject()
})
