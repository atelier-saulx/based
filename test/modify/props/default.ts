import { deepEqual } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify - default values basic', async (t) => {
  const db = await testDb(t, {
    locales: { en: true },
    types: {
      thing: {
        name: { type: 'string', default: 'Untitled' },
        score: { type: 'number', default: 100 },
        isActive: { type: 'boolean', default: true },
        myEnum: { enum: ['a', 'b'], default: 'a' },
        myJson: { type: 'json', default: { foo: 'bar' } },
        myText: { type: 'text', default: { en: 'Hello' } },
        myTs: { type: 'timestamp', default: 1000 },
      },
    },
  })

  // 1. Create with no values provided
  const a = await db.create('thing', {})
  const resA: any = await db.query2('thing', a).get()
  deepEqual(resA, {
    id: a,
    name: 'Untitled',
    score: 100,
    isActive: true,
    myEnum: 'a',
    myJson: { foo: 'bar' },
    myText: { en: 'Hello' },
    myTs: 1000,
  })

  // 2. Create with specific values (override default)
  const b = await db.create('thing', {
    name: 'Specific',
    score: 10,
    isActive: false,
    myEnum: 'b',
    myJson: { foo: 'baz' },
    myText: { en: 'Hi' },
    myTs: 2000,
  })
  const resB = await db.query2('thing', b).get()
  deepEqual(resB, {
    id: b,
    name: 'Specific',
    score: 10,
    isActive: false,
    myEnum: 'b',
    myJson: { foo: 'baz' },
    myText: { en: 'Hi' },
    myTs: 2000,
  })

  // 3. Create with mixed values
  const c = await db.create('thing', { score: 50, myEnum: 'b' })
  const resC = await db.query2('thing', c).get()
  deepEqual(resC, {
    id: c,
    name: 'Untitled',
    score: 50,
    isActive: true,
    myEnum: 'b',
    myJson: { foo: 'bar' },
    myText: { en: 'Hello' },
    myTs: 1000,
  })
})

await test('modify - default values on edge', async (t) => {
  const db = await testDb(t, {
    locales: { en: true },
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
          $edgeEnum: { enum: ['a', 'b'], default: 'a' },
          $edgeJson: { type: 'json', default: { foo: 'bar' } },
          $edgeText: { type: 'text', default: { en: 'Hello' } },
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
    .query2('group', g1)
    .include('member.$role')
    .include('member.$level')
    .include('member.id')
    .get()

  deepEqual(resG1?.member?.$role, 'member')
  deepEqual(resG1?.member?.$level, 1)

  // 2. Create edge with edge props
  const g2 = await db.create('group', {
    member: {
      id: u1,
      $role: 'admin',
      $level: 99,
      $edgeEnum: 'b',
      $edgeJson: { foo: 'baz' },
      $edgeText: { en: 'Hi' },
    },
  })

  const resG2: any = await db
    .query2('group', g2)
    .include('member.$role')
    .include('member.$level')
    .include('member.id')
    .include('member.$edgeEnum')
    .include('member.$edgeJson')
    .include('member.$edgeText')
    .get()

  deepEqual(resG2.member?.$role, 'admin')
  deepEqual(resG2.member?.$level, 99)
  deepEqual(resG2.member?.$edgeEnum, 'b')
  deepEqual(resG2.member?.$edgeJson, { foo: 'baz' })
  deepEqual(resG2.member?.$edgeText, { en: 'Hi' })

  // 3. Check defaults on edge
  const g3 = await db.create('group', {
    member: { id: u1 },
  })

  const resG3: any = await db
    .query2('group', g3)
    .include('member.$role')
    .include('member.$level')
    .include('member.$edgeEnum')
    .include('member.$edgeJson')
    .include('member.$edgeText')
    .get()

  deepEqual(resG3.member?.$role, 'member')
  deepEqual(resG3.member?.$level, 1)
  deepEqual(resG3.member?.$edgeEnum, 'a')
  deepEqual(resG3.member?.$edgeJson, { foo: 'bar' })
  deepEqual(resG3.member?.$edgeText, { en: 'Hello' })
})
