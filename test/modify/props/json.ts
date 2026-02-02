import { deepEqual } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify json', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        data: 'json',
      },
    },
  })

  const obj = { foo: 'bar', baz: 123, list: [1, 2] }
  const id1 = await db.create('thing', {
    data: obj,
  })

  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    data: obj,
  })

  const arr = ['a', 'b', 'c']
  await db.update('thing', id1, {
    data: arr,
  })

  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    data: arr,
  })
})
