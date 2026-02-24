import { wait } from '@based/utils'
import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'
await test('youzi', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))
  await db.setSchema({
    locales: {
      nl: true,
    },
    types: {
      test: {
        description: 'text',
        vision: 'text',
        updatedAt: 'timestamp',
      },
      flap: {
        description: 'string',
        vision: 'string',
        updatedAt: 'timestamp',
      },
    },
  })

  const d = []

  // await db.query('test').sort('updatedAt').get().inspect()

  db.query('test')
    .locale('nl')
    .sort('vision')
    .subscribe((x) => {
      d.push(x.toObject())
    }, console.error)
  await wait(500)

  console.log('------------------------------')
  await db.create('test')

  await wait(300)

  deepEqual(d, [[], [{ id: 1, updatedAt: 0, description: '', vision: '' }]])

  // await db.query('test').sort('updatedAt').get().inspect()

  db.query('flap').sort('timestamp')

  await db.create('flap')
  await wait(300)

  deepEqual(await db.query('flap').sort('description').get().toObject(), [
    { id: 1, updatedAt: 0, description: '', vision: '' },
  ])

  await wait(300)
})
