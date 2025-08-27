import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'
import { wait } from '@based/utils'

await test('export to csv', async (t) => {
  const db = new BasedDb({
    path: '../exporter/tmp',
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      product: {
        // sku: { type: 'string', maxBytes: 10 },
        sku: 'number',
        flap: 'number',
      },
      // shelve: {
      //   code: 'number', //{ type: 'string', maxBytes: 4 },
      //   // products: {
      //   //   items: {
      //   //     ref: 'product',
      //   //     prop: 'product',
      //   //   },
      //   // },
      // },
    },
  })

  for (let j = 0; j < 1e3; j++) {
    for (let i = 0; i < 1e3; i++) {
      let p = db.create('product', {
        // sku: 'lala' + (Math.random() * 10).toFixed(0),
        sku: i,
        flap: i,
      })
      // db.create('shelve', {
      //   code: i,
      //   // code: 'S' + (Math.random() * 50).toFixed(0),
      //   // products: [p],
      // })
    }
    // console.log(
    //   `#${j} (${(j + 1) * 1000}M)`,
    //   (await db.drain()).toFixed(),
    //   'ms',
    // )
    await wait(10)
  }

  await db.drain()

  // cd ../exporter and run `npm run test`
  // check the id from the first and last lines of the exported csv with head/tail
  // check the number of lines like with `wc -l`
})
