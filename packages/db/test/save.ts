import { BasedDb } from '../src/index.js'
import { deepEqual, equal } from './shared/assert.js'
import test from './shared/test.js'
import { setTimeout } from 'node:timers/promises'

await test('save', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
    types: {
      user: {
        props: {
          name: { type: 'string' },
          email: { type: 'string' },
          age: { type: 'uint32' },
          story: { type: 'string' },
        },
      },
    },
  })

  db.create('user', {
    name: 'youzi',
    email: 'youzi@yazi.yo',
  })

  db.create('user', {
    name: 'youri',
    email: 'youri@yari.yo',
  })

  await db.drain()
  await db.save()
  const db2 = new BasedDb({
    path: t.tmp,
  })

  t.after(() => {
    return db2.destroy()
  })

  await db2.start()
  const a = await db.query('user').get().toObject()
  const b = await db2.query('user').get().toObject()

  //console.log(a, b)
  deepEqual(a, b)

  const c = await db.create('user', { name: 'jerp' })
  const d = await db2.create('user', { name: 'jerp' })
  equal(c, 3)
  equal(d, 3)
})

await test('save empty root', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start()

  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
    props: {
      rando: { type: 'string' },
    },
    types: {
      user: {
        props: {
          name: { type: 'string' },
          email: { type: 'string' },
          age: { type: 'uint32' },
          story: { type: 'string' },
        },
      },
    },
  })

  await db.save()
  await setTimeout(1e3)
})

await test('save refs', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
    types: {
      group: {
        props: {
          name: { type: 'string' },
          users: {
            items: {
              ref: 'user',
              prop: 'group',
            },
          },
        },
      },
      user: {
        props: {
          name: { type: 'string' },
          email: { type: 'string' },
          group: {
            ref: 'group',
            prop: 'users',
          },
        },
      },
    },
  })

  const grp = db.create('group', {
    name: 'best',
  })
  db.create('user', {
    name: 'youzi',
    email: 'youzi@yazi.yo',
    group: grp,
  })

  db.create('user', {
    name: 'youri',
    email: 'youri@yari.yo',
    group: grp,
  })
  await db.drain()
  await db.save()

  const db2 = new BasedDb({
    path: t.tmp,
  })
  t.after(() => {
    return db2.destroy()
  })
  await db2.start()

  const users1 = await db.query('user').include('group').get().toObject()
  const users2 = await db2.query('user').include('group').get().toObject()
  deepEqual(users1, users2)
})
