import { BasedDb } from '../src/index.js'
import { deepEqual, throws } from './shared/assert.js'
import test from './shared/test.js'

await test('insert only => no delete', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(async () => t.backup(db))

  const client = await db.setSchema({
    types: {
      audit: {
        insertOnly: true,
        props: {
          v: { type: 'number' },
        },
      },
    },
  })

  const a = await client.create('audit', { v: 100 })
  await client.create('audit', { v: 100 })
  await throws(() => client.delete('audit', a))
  deepEqual(await client.query('audit', a).get(), { id: 1, v: 100 })
})

await test('colvec requires insertOnly', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => db.destroy())

  await throws(() =>
    db.setSchema({
      types: {
        audit: {
          props: {
            v: { type: 'colvec', size: 3, baseType: 'float32' },
          },
        },
      },
    }),
  )
})
