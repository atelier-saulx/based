import { setTimeout } from 'node:timers/promises'
import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('saveInterval', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    saveIntervalInSeconds: 1,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.setSchema({
    types: {
      user: {
        props: {
          externalId: 'alias',
          potato: 'string',
        },
      },
    },
  })

  db.create('user', {
    externalId: 'cool',
    potato: 'fries',
  })

  db.create('user', {
    externalId: 'cool2',
    potato: 'wedge',
  })

  await db.drain()

  await setTimeout(1e3)

  const res1 = await db.query('user').get().toObject()

  await db.stop(true)

  const db2 = new BasedDb({
    path: t.tmp,
  })

  await db2.start()

  t.after(() => {
    return db2.destroy()
  })

  await db2.schemaIsSet()
  const res2 = await db2.query('user').get().toObject()

  deepEqual(res1, res2)
})
