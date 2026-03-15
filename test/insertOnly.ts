import { DbClient, DbServer, getDefaultHooks } from '../src/sdk.js'
import { deepEqual, throws } from './shared/assert.js'
import { testDb } from './shared/index.js'
import test from './shared/test.js'

await test('insert only => no delete', async (t) => {
  const client = await testDb(t, {
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
  const db = new DbServer({
    path: t.tmp,
  })

  await db.start({ clean: true })
  t.after(() => db.destroy())
  const client = new DbClient({
    hooks: getDefaultHooks(db),
  })

  await throws(() =>
    client.setSchema({
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
