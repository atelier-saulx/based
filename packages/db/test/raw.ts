import { BasedDb } from '../src/index.js'
import { deepEqual } from './shared/assert.js'
import test from './shared/test.js'

await test('raw', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        uniqueSkills: 'cardinality',
      },
    },
  })

  const one = await db.create('user', {
    uniqueSkills: ['juggling', 'cabaret'],
  })
  const { uniqueSkills } = await db
    .query('user', one)
    .include('uniqueSkills', { raw: true })
    .get()
    .toObject()

  await db.create('user', {
    uniqueSkills,
  })

  const [a, b] = await db.query('user').get().toObject()
  deepEqual(a.uniqueSkills, b.uniqueSkills)
})
