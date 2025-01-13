import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'
import { QueryDefType } from '../src/client/query/types.js'

await test('include', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  t.after(() => {
    return db.destroy()
  })

  await db.start({ clean: true })

  db.putSchema({
    props: {
      myString: 'string',
      myBoolean: 'boolean',
      topStores: {
        items: {
          ref: 'store',
        },
      },
    },
    types: {
      store: {
        props: {
          name: { type: 'string' },
          products: {
            type: 'references',
            items: {
              ref: 'product',
              prop: 'stores',
              //   $category: { enum: ['Clothing', 'Office'] }, // it is here but not in product
              $category: ['Clothing', 'Office'],
            },
          },
        },
      },
      product: {
        props: {
          name: { type: 'string' },
          price: 'number',
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
    price: 1.2,
    // $category: 'Office', // If I put this here pencil is silently ignored in log #4 and abroad
  })

  const pen = db.create('product', {
    name: 'Sakura Pen',
    price: 3.0,
  })
  const amazon = db.create('store', {
    name: 'Amazon',
    products: [pen, pencil],
  })

  const alibaba = db.create('store', {
    name: 'Alibaba',
    products: [pen],
  })

  // Also doesn't works
  const walmart = db.create('store', {
    name: 'Walmart',
    products: [
      {
        ...pencil,
        $category: 'Office',
      },
    ],
  })

  db.update({ myString: 'lala' })
  db.update({ topStores: [amazon, alibaba, walmart] })

  db.drain()

  // Root Queries
  // Only Props appear on empty a query() with empty param:
  console.log('1---->', (await db.query().get()).toObject())
  // WARN: Must be Type to be explicity queried in the root,
  // console.log('2---->', await db.query('myString').get()) // Will throw "Cannot read properties of undefined (reading 'props')
  // WARN: Will filter props, is that the expected behavour?
  console.log('2---->', (await db.query().include('myString').get()).toObject())
  // Will return the types
  console.log('3---->', (await db.query('store').get()).toObject())
  console.log('4---->', (await db.query('product').get()).toJSON())

  // Query References + Edges ($)
  // what is an edge here? is enough to be preceeded by '$''
  //   console.log(
  //     '5---->',
  //     (
  //       await db
  //         .query('store')
  //         .include('products.name') // Why amazon + pencil product is not beeing listed in the result?
  //         .get()
  //     ).inspect(),
  //   )

  //   console.log(
  //     '6---->',
  //     (
  //       await db.query().include('topStores', 'topStores.products').get()
  //     ).toJSON(),
  //   )
  //   // Again, topSories return only one store Alibaba (Alibaba does not have $category)
  //   console.log(
  //     '7---->',
  //     (await db.query().include('topStores.products.$category').get()).toJSON(),
  //   )
  //   //   console.log(
  //   //     '8---->',
  //   //     (await db.query('store').include('products.price').get()).inspect(),
  //   //   )

  //   // Edge

  //   // Reference

  //   // Props
  //   //  All this options are equivalent, it calls getAll() in the background, is this the desired behaviour?
  //   //   deepEqual(
  //   //     (await db.query('product').include().get()).toObject(),
  //   //     (await db.query('product').get()).toObject(),
  //   //     (await db.query('product').include('*').get()).toObject(),
  //   //   )
})
