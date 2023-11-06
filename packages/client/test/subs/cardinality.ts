import anyTest, { TestInterface } from 'ava'
import { wait } from '@saulx/utils'
import { TestCtx, observe, startSubs } from '../assertions'
import { BasedSchemaPartial } from '@based/schema'

const test = anyTest as TestInterface<TestCtx>

const schema: BasedSchemaPartial = {
  language: 'en',
  root: {
    fields: {
      trackUniqueOrigins: {
        type: 'set',
        items: { type: 'string' },
      },
      uniqueUsers: {
        type: 'record',
        values: {
          type: 'cardinality',
        },
      },
    },
  },
}

test.serial('record with cardinality', async (t) => {
  await startSubs(t, schema)
  const client = t.context.dbClient
  await client.set({
    $id: 'root',
    uniqueUsers: { total: 16558146173444 },
  })

  observe(
    t,
    {
      uniqueUsers: true,
    },
    (res) => {
      console.log('??', { res })
    }
  )

  await wait(1e3)

  await client.set({
    $id: 'root',
    uniqueUsers: { total: 16558146173444 },
  })

  await wait(1e3)

  t.pass()
})
