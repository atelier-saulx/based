import test from '../shared/test.js'
import { deepCopy } from '../../src/utils/index.js'
import type { SchemaIn } from '../../src/schema/index.js'
import { deepEqual } from '../shared/assert.js'
import { testDbClient, testDbServer } from '../shared/index.js'

await test('set schema dont migrate', async (t) => {
  const server = await testDbServer(t)
  const client = await testDbClient(server)

  let schema = {
    types: {
      yoyo: {
        props: {
          haha: 'boolean',
        },
      },
    },
  }

  let updates = 0
  client.on('schema', () => {
    updates++
  })

  await client.setSchema(deepCopy(schema) as SchemaIn)
  await client.setSchema(deepCopy(schema) as SchemaIn)
  await client.setSchema(deepCopy(schema) as SchemaIn)

  deepEqual(updates, 1, '1 update')
  // deepEqual(migrates, 0, '0 migrates')

  await client.setSchema({
    types: {
      yes: {
        name: 'string',
      },
      nope: {
        name: 'string',
      },
    },
  })

  // TODO: when https://linear.app/1ce/issue/FDN-1304 changes ignore this as no change
  // await db.setSchema({
  //   props: {
  //     badguy: 'boolean',
  //     coolguy: 'string',
  //   },
  //   types: {
  //     nope: {
  //       name: 'string',
  //     },
  //     yes: {
  //       name: 'string',
  //     },
  //   },
  // })

  deepEqual(updates, 2, '2 update')
  // deepEqual(migrates, 1, '1 migrates')

  await client.setSchema({
    types: {
      nope: {
        name: 'string',
      },
      yes: {
        name: 'string',
        success: 'boolean',
      },
    },
  })

  deepEqual(updates, 3, '3 update')
  // deepEqual(migrates, 2, '2 migrates')

  await client.create('nope', {
    name: 'abe',
  })

  await client.create('yes', {
    name: 'bill',
    success: true,
  })

  await client.setSchema({
    types: {
      nope: {
        name: 'string',
      },
      yes: {
        name: 'string',
        success: 'boolean',
      },
    },
  })

  deepEqual(updates, 4, '4 update')
  // deepEqual(migrates, 3, '3 migrates')
})
