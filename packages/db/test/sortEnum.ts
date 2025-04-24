import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'

await test('sort Enum', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return t.backup(db)
  })

  const status = ['a', 'b', 'c', 'd', 'e', 'f']
  await db.setSchema({
    types: {
      user: {
        props: {
          status,
        },
      },
    },
  })

  for (let i = 0; i < 1e6; i++) {
    db.create('user', {
      status: status[i % 6],
    })
  }

  const dbTime = await db.drain()

  console.log('derp', dbTime)

  let d = Date.now()
  let siTime = Date.now() - d
  equal(
    siTime < 500,
    true,
    'creating string sort index should not take longer then 500ms',
  )

  const r = await db.query('user').range(0, 1e5).sort('status').get()
  // filter
})
