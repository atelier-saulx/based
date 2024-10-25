import { join as pathJoin } from 'node:path'
import { copyFile, mkdir, readdir } from 'node:fs/promises'
import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'

await test('save simple range', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  db.blockSize = 1

  await db.start({ clean: true })
  t.after(() => {
    // TODO No crash if stopped
    //return db.destroy()
  })

  db.putSchema({
    types: {
      user: {
        props: {
          name: { type: 'string' },
          email: { type: 'string' },
          age: { type: 'uint32' },
        },
      },
    },
  })

  db.create('user', {
    age: 1337,
    name: 'mr disaster',
    email: 'disaster@disaster.co.uk',
  })
  db.create('user', {
    age: 1453,
    name: 'mr flop',
    email: 'flop@disaster.co.uk',
  })

  db.drain()
  await db.stop()

  const ls = await readdir(t.tmp)
  equal(ls.includes('common.sdb'), true)
  equal(ls.includes('65281_1_1.sdb'), true)
  equal(ls.includes('65281_2_2.sdb'), true)

  //db.start()
  const newDb = new BasedDb({
    path: t.tmp,
  })
  db.blockSize = 1
  await newDb.start()
  t.after(() => {
    return newDb.destroy()
  })

  deepEqual(
    newDb
      .query('user')
      .include('name')
      .sort('name')
      .range(0, 2)
      .get()
      .toObject(),
    [
      {
        id: 1,
        name: 'mr disaster',
      },
      {
        id: 2,
        name: 'mr flop',
      },
    ],
  )
})
