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

  await db.setSchema({
    props: {
      coolguy: 'string',
      badguy: 'boolean',
    },
    types: {
      yes: {
        name: 'string',
      },
      nope: {
        name: 'string',
      },
    },
  })

  await db.setSchema({
    props: {
      badguy: 'boolean',
      coolguy: 'string',
    },
    types: {
      nope: {
        name: 'string',
      },
      yes: {
        name: 'string',
      },
    },
  })

  deepEqual(updates, 2, '2 update')
  deepEqual(migrates, 1, '1 migrates')

  await db.setSchema({
    props: {
      badguy: 'boolean',
      coolguy: 'string',
      okguy: 'boolean',
    },
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
  deepEqual(migrates, 2, '2 migrates')

  await db.update({
    badguy: true,
    coolguy: 'arnold',
    okguy: true,
  })

  await db.create('nope', {
    name: 'abe',
  })

  await db.create('yes', {
    name: 'bill',
    success: true,
  })
})
