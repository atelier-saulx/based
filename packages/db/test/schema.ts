import test from './shared/test.js'
import { BasedDb } from '../src/index.js'

await test('support many fields on root', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  const props = {}
  for (let i = 0; i < 254; i++) {
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
  for (let i = 0; i < 254; i++) {
    props['myProp' + i] = 'string'
  }

  await db.setSchema({
    types: {
      flurp: props,
    },
  })
})
