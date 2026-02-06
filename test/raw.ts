import { BasedDb } from '../src/index.js'
import { deepEqual } from './shared/assert.js'
import {italy} from './shared/examples.js'
import test from './shared/test.js'

await test.skip('cardinality', async (t) => {
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

await test('string', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        name: 'string',
        role: { type: 'string', maxBytes: 4 },
        resume: { type: 'string', compression: 'deflate' },
      },
    },
  })

  const one = await db.create('user', {
    name: 'user',
    role: 'root',
    resume: italy,
  })
  const { name, role, resume } = await db
    .query('user', one)
    .include('name', { raw: true })
    .get()
    .toObject()

  await db.create('user', {
    name,
    role,
    resume,
  })

  const [a, b] = await db.query('user').get().toObject()
  deepEqual(a.name, b.name)
  deepEqual(a.role, b.role)
  deepEqual(a.resume, b.resume)
})
