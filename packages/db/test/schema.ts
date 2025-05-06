import test from './shared/test.js'
import { BasedDb } from '../src/index.js'

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
