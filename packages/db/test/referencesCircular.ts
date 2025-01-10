import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('e-com', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  t.after(() => {
    return db.destroy()
  })

  await db.start({ clean: true })

  db.putSchema({
    types: {
      user: {
        props: {
          age: 'number',
          sex: ['Male', 'Female', 'Intersex', 'X', 'Prefer not to Say'],
          name: 'string',
          bought: {
            type: 'references',
            items: {
              ref: 'product',
              prop: 'buyers',
            },
          },
        },
      },
      product: {
        props: {
          name: 'string',
          category: ['Clothing', 'Gadgets', 'Computers'],
          price: 'uint32',
          buyers: {
            items: {
              ref: 'user',
              prop: 'bought',
            },
          },
          sellers: {
            items: {
              ref: 'seller',
              prop: 'products',
            },
          },
        },
      },
      seller: {
        props: {
          name: 'string',
          url: 'string',
          products: {
            items: {
              ref: 'product',
              prop: 'sellers',
            },
          },
        },
      },
    },
  })

  const lala = db.create('user', {
    name: 'Mr Lala',
    age: 32,
  })

  const lele = db.create('user', {
    name: 'Mrs Lele',
    age: 23,
  })

  db.drain()

  const mouse = db.create('product', {
    name: 'Keychron M3 Mini BT Mouse',
    category: 'Gadgets',
    buyers: [lala, lele],
    //   sellers: [amazon]
  })

  const amazon = db.create('seller', {
    name: 'Amazon',
    url: 'amazon.com',
    //   products: [mouse]
  })

  db.drain()

  const xiaomi = db.create('seller', {
    name: 'Xiaomi',
    url: 'xiaomi.com',
    // products: [mirror]
  })

  const mirror = db.create('product', {
    name: 'Xiaomi Smart Mirror',
    category: 'Gadgets',
    sellers: [amazon, xiaomi],
    buyers: [lele],
  })

  db.drain()

  await db.update('seller', amazon, {
    products: {
      add: [mouse, mirror],
    },
  })

  db.drain()

  // WARNING!: Running this (to establish the reverse link between 'xiaomi' and 'mirror') will
  //  cause a catastrophic thread crash (SIGABRT).
  // await db.update('seller', xiaomi, {
  //     products: {
  //       add: [mirror],
  //     },
  //   })

  // db.drain()

  console.log('===> 1')
  deepEqual(
    (
      await db.query('product').include('*', 'buyers', 'sellers').get()
    ).toObject(),
    [
      {
        id: 1,
        category: 'Gadgets',
        price: 0,
        name: 'Keychron M3 Mini BT Mouse',
        buyers: [
          { id: 1, age: 32, sex: undefined, name: 'Mr Lala' },
          { id: 2, age: 23, sex: undefined, name: 'Mrs Lele' },
        ],
        sellers: [{ id: 1, name: 'Amazon', url: 'amazon.com' }],
      },
      {
        id: 2,
        category: 'Gadgets',
        price: 0,
        name: 'Xiaomi Smart Mirror',
        buyers: [{ id: 2, age: 23, sex: undefined, name: 'Mrs Lele' }],
        sellers: [
          { id: 1, name: 'Amazon', url: 'amazon.com' },
          { id: 2, name: 'Xiaomi', url: 'xiaomi.com' },
        ],
      },
    ],
  )
  console.log('===> 2')
  deepEqual((await db.query('user').include('bought.name').get()).toObject(), [
    {
      id: 1,
      bought: [{ id: 1, name: 'Keychron M3 Mini BT Mouse' }],
    },
    {
      id: 2,
      bought: [
        { id: 1, name: 'Keychron M3 Mini BT Mouse' },
        { id: 3, name: 'Xiaomi Smart Mirror' },
      ],
    },
  ])
})
