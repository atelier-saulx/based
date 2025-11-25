import { BasedDb } from '../../src/index.js'
import test from '../shared/test.js'
import { deepEqual, equal } from '../shared/assert.js'

await test('upsert', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
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

  deepEqual(await db.query('user', user1).get(), {
    id: 1,
    status: 'a',
    externalId: 'cool',
  })

  await db.update('user', user1, {
    externalId: null,
    status: 'b',
  })

  deepEqual(await db.query('user', user1).get(), {
    id: 1,
    status: 'b',
    externalId: '',
  })
})
