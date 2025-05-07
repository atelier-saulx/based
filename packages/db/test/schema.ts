import test from './shared/test.js'
import { BasedDb } from '../src/index.js'
import { setTimeout } from 'node:timers/promises'
import { deepEqual } from './shared/assert.js'
await test('support many fields on root', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  const props = {}
  for (let i = 0; i < 248; i++) {
    props['myProp' + i] = 'string'
  }

  await db.setSchema({
    props,
  })
})

await test('support many fields on type', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  const props = {}
  for (let i = 0; i < 248; i++) {
    props['myProp' + i] = 'string'
  }

  await db.setSchema({
    types: {
      flurp: props,
    },
  })
})

await test('schema hash', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  await db.setSchema({
    types: {
      flurp: {
        name: 'string',
      },
    },
  })

  const hash1 = db.server.schema.hash

  await db.setSchema({
    types: {
      flurp: {
        name: 'string',
        title: 'string',
      },
    },
  })

  const hash2 = db.server.schema.hash

  if (!hash1 || !hash2 || hash1 === hash2) {
    throw new Error('Incorrect hash')
  }
})

await test('dont accept modify with mismatch schema', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  db.client.hooks.flushModify = async (buf) => {
    await setTimeout(100)
    return {
      offsets: db.server.modify(buf),
    }
  }

  await db.setSchema({
    types: {
      flurp: {
        name: 'string',
      },
    },
  })

  await db.create('flurp', {
    name: 'xxx',
  })

  const q1 = db.query('flurp')

  const setSchemaPromise = db.setSchema({
    types: {
      flurp: {
        title: 'string',
      },
    },
  })

  await db.create('flurp', {
    name: 'yyy',
  })

  await setSchemaPromise
  const res = await db.query('flurp').get().toObject()

  deepEqual(res, [{ id: 1, title: '' }])

  console.log('???', await q1.get().toObject())
})
