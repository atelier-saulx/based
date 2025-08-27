import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'
import { wait } from '@based/utils'

await test.skip('csv performance', async (t) => {
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
    },
  })

  for (let j = 0; j < 1e3; j++) {
    for (let i = 0; i < 1e5; i++) {
      let p = db.create('product', {
        // sku: 'lala' + (Math.random() * 10).toFixed(0),
        sku: i,
        flap: i,
      })
    }
    // console.log(
    //   `#${j} (${(j + 1) * 1000}M)`,
    //   (await db.drain()).toFixed(),
    //   'ms',
    // )
    await wait(10)
  }

  await db.drain()
})

await test('export to csv', async (t) => {
  const db = new BasedDb({
    path: '../exporter/tmp',
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  const cat = ['toy', 'food', 'weapon']

  await db.setSchema({
    types: {
      product: {
        sku: { type: 'string', maxBytes: 10 },
        flap: 'number',
        flip: 'int8',
        expiration: 'timestamp',
        category: cat,
        meta: 'json',
        description: 'text',
      },
      shelve: {
        code: { type: 'string', maxBytes: 4 },
        // products: {
        //   items: {
        //     ref: 'product',
        //     prop: 'product',
        //   },
        // },
      },
    },
  })

  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 1000; i++) {
      let p = db.create('product', {
        sku: 'lala' + (Math.random() * 10).toFixed(0),
        flap: i,
        flip: +(Math.random() * 10).toFixed(0),
        expiration: new Date(),
        category: cat[j],
        meta: '{ "lala": ["lele, lili"]}',
        description: 'ufgiwegflhie"gF WFEW wf \newF EHWBFlh ewvb""dlHFVWH Dilv',
      })
      db.create('shelve', {
        code: 'S' + (Math.random() * 50).toFixed(0),
        // products: [p],
      })
    }

    await wait(10)
  }

  await db.drain()
})
