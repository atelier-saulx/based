import test from './shared/test.js'
import { BasedDb } from '../src/index.js'
import { deepCopy } from '@saulx/utils'
import { Schema } from '@based/schema'
import { deepEqual } from './shared/assert.js'

await test('set schema dont migrate', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => db.destroy())

  let schema = {
    props: {
      haha: 'boolean',
    },
  }

  let updates = 0
  let migrates = 0
  db.client.on('schema', () => {
    updates++
  })

  const migrateSchema = db.server.migrateSchema

  // @ts-ignore
  db.server.migrateSchema = (...args) => {
    migrates++
    return migrateSchema.apply(db.server, args)
  }

  await db.setSchema(deepCopy(schema) as Schema)
  await db.setSchema(deepCopy(schema) as Schema)
  await db.setSchema(deepCopy(schema) as Schema)

  deepEqual(updates, 1, '1 update')
  deepEqual(migrates, 0, '0 migrates')

  // await db.setSchema({
  //   props: {
  //     coolguy: 'string'
  //   },
  //   types: {
  //     yes: {

  //     }
  //   }
  // })
})
