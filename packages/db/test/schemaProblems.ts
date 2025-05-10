import test from './shared/test.js'
import { BasedDb } from '../src/index.js'
import { setTimeout } from 'node:timers/promises'
import { deepEqual } from './shared/assert.js'

await test('empty schema dont crash', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  // await db.start({ clean: true })
  // t.after(() => db.destroy())

  // const props = {}
  // for (let i = 0; i < 248; i++) {
  //   props['myProp' + i] = 'string'
  // }

  // await db.setSchema({
  //   props,
  // })
})
