import { parseSchema } from '../../../src/schema.js'
import { deepEqual, throws } from '../../shared/assert.js'
import { testDb } from '../../shared/index.js'
import test from '../../shared/test.js'

await test('modify alias', async (t) => {
  const db = await testDb(t, {
    types: {
      thing: {
        myAlias: 'alias',
      },
    },
  })

  // Basic alias
  const id1 = await db.create('thing', {
    myAlias: 'my-alias-value',
  })
  const id2 = await db.create('thing', {
    myAlias: 'b-alias',
  })
  deepEqual(await db.query2('thing', id1).get(), {
    id: id1,
    myAlias: 'my-alias-value',
  })
  // Update
  await db.update('thing', id1, {
    myAlias: 'another-alias',
  })
  deepEqual(await db.query2('thing', id1).get(), {
    id: id1,
    myAlias: 'another-alias',
  })

  await db.update('thing', id2, {
    myAlias: 'another-alias',
  })
  deepEqual(await db.query2('thing', { myAlias: 'b-alias' }).get(), null)
  deepEqual(await db.query2('thing', { myAlias: 'another-alias' }).get(), {
    id: id2,
    myAlias: 'another-alias',
  })
  deepEqual(await db.query2('thing', id1).get(), {
    id: id1,
    myAlias: '',
  })
  // Delete
  await db.update('thing', id2, {
    myAlias: null,
  })
  deepEqual((await db.query2('thing', id2).get())!.myAlias, '')
})

await test('schema alias on edge not allowed', async (t) => {
  throws(async () =>
    parseSchema({
      types: {
        thing: {
          myAlias: 'alias',
        },
        holder: {
          // @ts-expect-error
          toThing: {
            ref: 'thing',
            prop: 'holders',
            $edgeAlias: 'alias',
          },
        },
      },
    }),
  )
})
