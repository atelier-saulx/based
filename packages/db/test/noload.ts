import { BasedDb } from '../src/index.js'
import { deepEqual } from './shared/assert.js'
import test from './shared/test.js'
import NAMES from './shared/names.js'

await test('noLoadDumps', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  await db.setSchema({
    types: {
      employee: {
        blockCapacity: 1025,
        props: {
          name: { type: 'string' },
          email: { type: 'string' },
          reportsTo: { ref: 'employee', prop: 'subordinates' },
        },
      },
    },
  })

  db.create('employee', {
    name: 'youzi',
    email: 'youzi@yazi.yo',
  })
  db.create('employee', {
    name: 'doug',
    email: 'doug@yari.yo',
    reportsTo: 1,
  })
  for (let i = 0; i < 1500; i++) {
    const name = NAMES[i % NAMES.length]
    const email = `${name.toLowerCase().replace(' ', '.')}@yari.yo`
    db.create('employee', {
      name,
      email,
      reportsTo: i % 2 + 1,
    })
  }

  deepEqual(await db.query('employee').include('*').range(0, 2).get().toObject(), [
    { id: 1, name: 'youzi', email: 'youzi@yazi.yo' },
    { id: 2, name: 'doug', email: 'doug@yari.yo' }
  ])
  await db.drain()
  await db.save()

  const db2 = new BasedDb({
    path: t.tmp,
  })
  await db2.start({ noLoadDumps: true })
  t.after(() => db2.destroy())

  deepEqual(await db2.query('employee').include('*').get().toObject(), [])
  await db2.server.loadBlock('employee', 1)
  deepEqual(await db2.query('employee').include('*').range(0, 2).get().toObject(), [
    { id: 1, name: 'youzi', email: 'youzi@yazi.yo' },
    { id: 2, name: 'doug', email: 'doug@yari.yo' }
  ])
  // await db2.query('employee').count('subordinates').get().inspect()
  // deepEqual(await db2.query('employee', 1).count('subordinates').get().toObject(), 750 TODO
})
