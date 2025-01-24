import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('include', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  t.after(() => {
    return db.destroy()
  })

  await db.start({ clean: true })

  await db.putSchema({
    types: {
      store: {
        props: {
          name: { type: 'string' },
          products: {
            type: 'references',
            items: {
              ref: 'product',
              prop: 'stores',
            },
          },
        },
      },
      product: {
        props: {
          name: { type: 'string' },
          stores: {
            type: 'references',
            items: {
              ref: 'store',
              prop: 'products',
            },
          },
        },
      },
    },
  })

  const pencil = db.create('product', {
    name: 'Faber Castell Pencil',
  })

  const pen = db.create('product', {
    name: 'Sakura Pen',
  })

  const amazon = db.create('store', {
    name: 'Amazon',
    products: [pen, pencil],
  })

  const alibaba = db.create('store', {
    name: 'Alibaba',
    products: [pen],
  })

  await db.drain()

  console.log(
    '===> include tests: ',
    await db.query('products').include('*').get(),
  )
})
