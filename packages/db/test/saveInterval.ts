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
  t.after(() => db.destroy())

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

  console.log('1')
  const res1 = await db.query('user').get().toObject()
  console.log('2')

  await db.stop(true)
  console.log('3')

  const db2 = new BasedDb({
    path: t.tmp,
  })
  console.log('4')
  await db2.start()
  console.log('5')
  t.after(() => db2.destroy())
  console.log('5b')

  await db2.schemaIsSet()
  console.log('6')
  const res2 = await db2.query('user').get().toObject()
  console.log('7')

  deepEqual(res1, res2)
})
