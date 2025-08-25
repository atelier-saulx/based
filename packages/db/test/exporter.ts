import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('kev', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      product: {
        name: { type: 'string', maxBytes: 10 },
        flap: 'number',
      },
      shelve: {
        code: { type: 'string', maxBytes: 4 },
        products: {
          items: {
            ref: 'product',
            prop: 'product',
          },
        },
      },
    },
  })
  for (let i = 0; i < 100; i++) {
    let p = db.create('product', {
      name: 'lala' + (Math.random() * 10).toFixed(0),
      flap: Math.random() * 100,
    })
    db.create('shelve', {
      code: 'S' + (Math.random() * 10).toFixed(0),
      products: [p],
    })
  }

  await db.drain()
  await db.save()

  // const serialized = serialize(testSchema)

  // const deserialized = deSerialize(serialized)
})
