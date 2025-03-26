import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('default', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.setSchema({
    types: {
      user: {
        props: {
          isNice: {
            type: 'boolean',
            default: true,
          },
        },
      },
    },
  })

  await db.create('user', {})

  deepEqual(await db.query('user').get(), [{ id: 1, isNice: true }])
})
