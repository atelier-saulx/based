import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('nuno', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
    types: {
      user: {
        props: {
          externalId: 'alias',
          status: ['a', 'b'],
        },
      },
    },
  })

  const user1 = await db.create('user', {
    externalId: 'cool',
    status: 'a',
  })

  console.log('-->', await db.query('user', user1).get().toObject())

  await db.update('user', user1, {
    externalId: null,
    status: 'b',
  })

  console.log('-->', await db.query('user', user1).get().toObject())
})
