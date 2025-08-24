import { BasedDb } from '../src/index.js'
import { deepEqual } from './shared/assert.js'
import test from './shared/test.js'
import NAMES from './shared/names.js'
import {makeTreeKey} from '../src/server/tree.js'

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

  const getBlock1 = () => db2.server.verifTree.getBlock(makeTreeKey(db2.client.schema.types['employee'].id, 1))
  const getBlock2 = () => db2.server.verifTree.getBlock(makeTreeKey(db2.client.schema.types['employee'].id, 1200))

  deepEqual(await db2.query('employee').include('*').get().toObject(), [])
  await db2.server.loadBlock('employee', 1)
  deepEqual(await db2.query('employee').include('*').range(0, 2).get().toObject(), [
    { id: 1, name: 'youzi', email: 'youzi@yazi.yo' },
    { id: 2, name: 'doug', email: 'doug@yari.yo' }
  ])
  // deepEqual(await db2.query('employee', 2).count('subordinates').get().toObject(), 750 TODO
  deepEqual((await db2.query('employee', 2).include('subordinates').get().toObject()).subordinates.length, 750)

  deepEqual(getBlock1().inmem, true)
  deepEqual(getBlock2().inmem, false)

  await db2.server.loadBlock('employee', 1100)
  deepEqual(getBlock2().inmem, true)
  deepEqual((await db2.query('employee', 2).include('subordinates').get().toObject()).subordinates.length, 750)

  await db2.server.unloadBlock('employee', 1100)
  deepEqual(getBlock2().inmem, false)
  // FIXME refs shouldn't probably disappear on unload
  //deepEqual((await db2.query('employee', 2).include('subordinates').get().toObject()).subordinates.length, 750)
})
