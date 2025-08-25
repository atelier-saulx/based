import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('export to csv', async (t) => {
  const db = new BasedDb({
    path: '../exporter/tmp',
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      product: {
        sku: { type: 'string', maxBytes: 10 },
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
  // 1M items, 1K SKUs, 50 shelves
  for (let i = 0; i < 1e6; i++) {
    let p = db.create('product', {
      sku: 'lala' + (Math.random() * 10).toFixed(0),
      flap: Math.random() * 1000,
    })
    db.create('shelve', {
      code: 'S' + (Math.random() * 50).toFixed(0),
      products: [p],
    })
  }

  await db.drain()
  await db.save()

  // cd ../exporter and run `npm run test`
  // check the first line of a exported csv
  // check the number of lines like with `wc -l`
})
