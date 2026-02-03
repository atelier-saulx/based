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

  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    myAlias: 'my-alias-value',
  })

  // Update
  await db.update('thing', id1, {
    myAlias: 'another-alias',
  })

  deepEqual(await db.query('thing', id1).get(), {
    id: id1,
    myAlias: 'another-alias',
  })
})

await test('schema alias on edge not allowed', async (t) => {
  throws(async () => {
    const schema = parseSchema({
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
    })
    console.log(schema)
  })
})
