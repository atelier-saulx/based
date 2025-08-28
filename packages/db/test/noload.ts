import assert from 'node:assert'
import { fastPrng } from '@based/utils'
import { BasedDb } from '../src/index.js'
import { deepEqual } from './shared/assert.js'
import test from './shared/test.js'
import NAMES from './shared/names.js'
import { makeTreeKey, VerifBlock } from '../src/server/tree.js'

function makeEmployee(i: number) {
  const name = NAMES[i % NAMES.length]
  const email = `${name.toLowerCase().replace(' ', '.')}@yari.yo`
  return {
    name,
    email,
    reportsTo: null,
  }
}

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
    const employee = makeEmployee(i)
    employee.reportsTo = (i % 2) + 1
    db.create('employee', employee)
  }

  deepEqual(
    await db.query('employee').include('*').range(0, 2).get().toObject(),
    [
      { id: 1, name: 'youzi', email: 'youzi@yazi.yo' },
      { id: 2, name: 'doug', email: 'doug@yari.yo' },
    ],
  )

  await db.drain()
  await db.save()
  const db2 = new BasedDb({
    path: t.tmp,
  })
  await db2.start({ noLoadDumps: true })
  t.after(() => db2.destroy())

  const getBlock1 = () =>
    db2.server.verifTree.getBlock(
      makeTreeKey(db2.client.schema.types['employee'].id, 1),
    )
  const getBlock2 = () =>
    db2.server.verifTree.getBlock(
      makeTreeKey(db2.client.schema.types['employee'].id, 1200),
    )

  deepEqual(await db2.query('employee').include('*').get().toObject(), [])
  await db2.server.loadBlock('employee', 1)
  deepEqual(
    await db2.query('employee').include('*').range(0, 2).get().toObject(),
    [
      { id: 1, name: 'youzi', email: 'youzi@yazi.yo' },
      { id: 2, name: 'doug', email: 'doug@yari.yo' },
    ],
  )
  // deepEqual(await db2.query('employee', 2).count('subordinates').get().toObject(), 750 TODO
  deepEqual(
    (await db2.query('employee', 2).include('subordinates').get().toObject())
      .subordinates.length,
    750,
  )

  deepEqual(getBlock1().inmem, true)
  deepEqual(getBlock2().inmem, false)

  await db2.server.loadBlock('employee', 1100)
  deepEqual(getBlock2().inmem, true)
  deepEqual(
    (await db2.query('employee', 2).include('subordinates').get().toObject())
      .subordinates.length,
    750,
  )

  await db2.server.unloadBlock('employee', 1100)
  deepEqual(getBlock2().inmem, false)
  // FIXME refs shouldn't probably disappear on unload
  //deepEqual((await db2.query('employee', 2).include('subordinates').get().toObject()).subordinates.length, 750)

  // for (const type of db2.server.verifTree.types()) {
  //   for (const block of db2.server.verifTree.blocks(type)) {
  //     console.log(block)
  //   }
  // }
})

await test('references', async (t) => {
  let db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())
  const reload = async () => {
    await db.drain()
    await db.save()
    const db2 = new BasedDb({
      path: t.tmp,
    })
    await db2.start({ noLoadDumps: true })
    t.after(() => db2.destroy())
    db.destroy()
    db = db2
  }

  await db.setSchema({
    types: {
      employee: {
        blockCapacity: 1025,
        props: {
          name: { type: 'string', maxBytes: 25 },
          email: { type: 'string', maxBytes: 40 },
          reportsTo: { ref: 'employee', prop: 'subordinates' },
        },
      },
      project: {
        props: {
          name: { type: 'string', maxBytes: 10 },
          manager: { ref: 'employee', prop: 'project' },
        },
      },
    },
  })

  const prng = fastPrng()
  const rnd = () => prng(1, NAMES.length + 1)

  for (let i = 0; i < 2000; i++) {
    const employee = makeEmployee(i)
    employee.reportsTo = rnd()
    db.create('employee', employee)
  }

  for (let i = 0; i < 500; i++) {
    db.create('project', {
      name: NAMES[rnd()].split(' ')[0],
      manager: rnd(),
    })
  }

  await reload()
  for (const type of db.server.verifTree.types()) {
    for (const block of db.server.verifTree.blocks(type)) {
      deepEqual(block.inmem, false)
    }
  }

  // Test that a single block of a partially loaded type with references has
  // the same hash as it originally had when the type was fully loaded.
  // There is no assert for that directly because loadBlock would throw.
  const p = db.server.loadBlock('employee', 1)
  let block1: VerifBlock
  for (const type of db.server.verifTree.types()) {
    for (const block of db.server.verifTree.blocks(type)) {
      if (block.key === 8589934593) {
        assert(block.loadPromise)
        deepEqual(block.inmem, false)
        block1 = block
      }
    }
  }
  await p
  assert(!block1.loadPromise)
  deepEqual(block1.inmem, true)
})
