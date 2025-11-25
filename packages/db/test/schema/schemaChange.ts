import test from '../shared/test.js'
import { BasedDb } from '../../src/index.js'
import { deepCopy } from '../../src/utils/index.js'
import type { SchemaIn } from '../../src/schema/index.js'
import { deepEqual } from '../shared/assert.js'

await test('set schema dont migrate', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => db.destroy())

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
  db.client.on('schema', () => {
    updates++
  })

  await db.setSchema(deepCopy(schema) as SchemaIn)
  await db.setSchema(deepCopy(schema) as SchemaIn)
  await db.setSchema(deepCopy(schema) as SchemaIn)

  deepEqual(updates, 1, '1 update')
  // deepEqual(migrates, 0, '0 migrates')

  await db.setSchema({
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

  await db.setSchema({
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

  await db.create('nope', {
    name: 'abe',
  })

  await db.create('yes', {
    name: 'bill',
    success: true,
  })

  await db.setSchema({
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
