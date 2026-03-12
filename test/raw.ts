import { deepEqual } from './shared/assert.js'
import { italy } from './shared/examples.js'
import { testDb } from './shared/index.js'
import test from './shared/test.js'

await test.skip('cardinality', async (t) => {
  const db = await testDb(t, {
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

  await db.create('user', {
    uniqueSkills,
  })

  const [a, b] = await db.query('user').get()
  deepEqual(a.uniqueSkills, b.uniqueSkills)
})

await test('string', async (t) => {
  const db = await testDb(t, {
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
  const { name, role, resume } =
    (await db
      .query('user', one)
      .include(['name', 'role', 'resume'], { raw: true })
      .get()) ?? {}

  await db.create('user', {
    name,
    role,
    resume,
  })

  const [a, b] = await db.query('user').get()
  deepEqual(a.name, b.name)
  deepEqual(a.role, b.role)
  deepEqual(a.resume, b.resume)
})
