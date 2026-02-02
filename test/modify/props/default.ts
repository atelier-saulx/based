import { deepEqual } from '../shared/assert.js'
import { testDb } from '../shared/index.js'
import test from '../shared/test.js'

await test('modify - default values basic', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        name: { type: 'string', default: 'Untitled' },
        score: { type: 'number', default: 100 },
        isActive: { type: 'boolean', default: true },
      },
    },
  })

  // 1. Create with no values provided
  const a = await db.create('thing', {})
  const resA = await db.query('thing', a).get()
  deepEqual(resA, { id: a, name: 'Untitled', score: 100, isActive: true })

  // 2. Create with specific values (override default)
  const b = await db.create('thing', {
    name: 'Specific',
    score: 10,
    isActive: false,
  })
  const resB = await db.query('thing', b).get()
  deepEqual(resB, { id: b, name: 'Specific', score: 10, isActive: false })

  // 3. Create with mixed values
  const c = await db.create('thing', { score: 50 })
  const resC = await db.query('thing', c).get()
  deepEqual(resC, { id: c, name: 'Untitled', score: 50, isActive: true })
})

await test('modify - default values on edge', async (t) => {
  const db = await testDb(t, {
    types: {
      user: {
        name: 'string',
      },
      group: {
        member: {
          ref: 'user',
          prop: 'groups',
          $role: { type: 'string', default: 'member' },
          $level: { type: 'number', default: 1 },
        },
      },
    },
  })

  const u1 = await db.create('user', { name: 'u1' })

  // 1. Create edge without edge props
  const g1 = await db.create('group', {
    member: { id: u1 },
  })

  const resG1 = await db
    .query('group', g1)
    .include('member.$role')
    .include('member.$level')
    .include('member.id')
    .get()
    .toObject()

  deepEqual(resG1.member?.$role, 'member')
  deepEqual(resG1.member?.$level, 1)

  // 2. Create edge with edge props
  const g2 = await db.create('group', {
    member: { id: u1, $role: 'admin', $level: 99 },
  })

  const resG2 = await db
    .query('group', g2)
    .include('member.$role')
    .include('member.$level')
    .include('member.id')
    .get()
    .toObject()

  deepEqual(resG2.member?.$role, 'admin')
  deepEqual(resG2.member?.$level, 99)
})
