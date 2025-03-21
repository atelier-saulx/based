import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('isModified', async (t) => {
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
          nr: 'uint32',
        },
      },
    },
  })

  for (let i = 0; i < 1e6; i++) {
    db.create('user', { nr: i })
  }

  const results = await db.query('user').get().toObject()

  console.log('X', results)

  // deepEqual((await db.query('user').filter('isNice', false).get()).toObject(), [
  //   { id: 1, isNice: false },
  //   { id: 3, isNice: false },
  // ])
})
