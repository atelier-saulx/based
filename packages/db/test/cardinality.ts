import { BasedDb, xxHash64 } from '../src/index.js'
import type { SchemaType } from '@based/schema'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'
import { fastPrng } from '@based/utils'

const ENCODER = new TextEncoder()

await test('hll', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      article: {
        derp: 'number',
        myUniqueValuesCount: 'cardinality',
        myUniqueValuesCountFromArray: 'cardinality',
        contributors: {
          items: {
            ref: 'user',
            prop: 'articles',
            $tokens: 'cardinality',
            $undeftokens: 'cardinality',
          },
        },
      },
      user: {
        props: {
          name: 'number',
          articles: {
            items: {
              ref: 'article',
              prop: 'contributors',
            },
          },
        },
      },
    },
  })

  let myArticle = await db.create('article', {
    myUniqueValuesCount: 'myCoolValue',
  })

  deepEqual(
    (
      await db
        .query('article')
        .include('myUniqueValuesCount', 'myUniqueValuesCountFromArray')
        .get()
    ).toObject(),
    [
      {
        id: 1,
        myUniqueValuesCount: 1,
        myUniqueValuesCountFromArray: 0,
      },
    ],
  )

  deepEqual(
    (
      await db
        .query('article')
        .include('myUniqueValuesCount')
        .filter('myUniqueValuesCount', '!=', 0)
        .get()
    ).toObject(),
    [
      {
        id: 1,
        myUniqueValuesCount: 1,
      },
    ],
    'Not filter',
  )

  await db.create('article', {
    myUniqueValuesCountFromArray: [
      'myCoolValue',
      'myCoolValue',
      'mr snurfels',
      'mr snurfels',
      'lala',
      'lala',
      'myCoolValue',
      'myCoolValue',
      'mr snurfels',
      'mr snurfels',
      'lala',
      'lala',
      'lele',
      'lili',
      'lolo',
      'lulu',
    ],
  })

  deepEqual(
    (
      await db
        .query('article')
        .include('myUniqueValuesCount', 'myUniqueValuesCountFromArray')
        .get()
    ).toObject(),
    [
      { id: 1, myUniqueValuesCount: 1, myUniqueValuesCountFromArray: 0 },
      { id: 2, myUniqueValuesCountFromArray: 7, myUniqueValuesCount: 0 },
    ],
  )

  deepEqual(
    (
      await db
        .query('article')
        .include('myUniqueValuesCountFromArray')
        .filter('myUniqueValuesCountFromArray', '=', 7)
        .get()
    ).toObject(),
    [
      {
        id: 2,
        myUniqueValuesCountFromArray: 7,
      },
    ],
  )

  deepEqual(
    (
      await db
        .query('article')
        .include('myUniqueValuesCount')
        .filter('myUniqueValuesCount', '>', 1)
        .get()
    ).toObject(),
    [],
  )

  await db.update('article', myArticle, {
    myUniqueValuesCount: [
      'myCoolValue',
      'myCoolValue',
      'mr snurfels',
      'mr snurfels',
      'lala',
      'lala',
      'myCoolValue',
      'myCoolValue',
      'mr snurfels',
      'mr snurfels',
      'lala',
      'lala',
      'lele',
      'lili',
      'lolo',
      'lulu',
    ],
  })

  await db.drain()

  deepEqual(
    (
      await db
        .query('article')
        .include('myUniqueValuesCount', 'myUniqueValuesCountFromArray')
        .get()
    ).toObject(),
    [
      { id: 1, myUniqueValuesCount: 7, myUniqueValuesCountFromArray: 0 },
      { id: 2, myUniqueValuesCountFromArray: 7, myUniqueValuesCount: 0 },
    ],
  )

  const feeling = ['foolish', 'superficial', 'deep', 'moving', 'fake']

  let feelings = []
  for (let i = 0; i < 1e6; i++) {
    feelings.push(
      xxHash64(
        ENCODER.encode(
          feeling[Math.floor(Math.random() * (feeling.length - 1))],
        ),
      ),
    )
  }

  await db.update('article', myArticle, {
    myUniqueValuesCount: feelings,
  })

  await db.drain()

  deepEqual(
    (
      await db
        .query('article')
        .filter('myUniqueValuesCount', '=', 11)
        .or('myUniqueValuesCountFromArray', '>', 6)
        .get()
    ).toObject(),
    [
      {
        id: 1,
        derp: 0,
        myUniqueValuesCount: 11,
        myUniqueValuesCountFromArray: 0,
      },
      {
        id: 2,
        derp: 0,
        myUniqueValuesCountFromArray: 7,
        myUniqueValuesCount: 0,
      },
    ],
  )

  // -------- edges
  const mrSnurp = db.create('user', {
    name: 900,
  })
  const edge = await db.create('article', {
    derp: 813,
    contributors: [{ id: mrSnurp, $tokens: ['lala', 'lele', 'lili'] }],
  })

  deepEqual(
    await db
      .query('article')
      .filter('id', '>=', 3)
      .include('contributors.$tokens')
      .get(),
    [
      {
        id: 3,
        contributors: [
          {
            id: 1,
            $tokens: 3,
          },
        ],
      },
    ],
    '3 distinct filter',
  )
  await db.update('article', edge, {
    contributors: [
      {
        id: mrSnurp,
        $tokens: [
          'myCoolValue',
          'myCoolValue',
          'mr snurfels',
          'mr snurfels',
          'lala',
          'lala',
          'myCoolValue',
          'myCoolValue',
          'mr snurfels',
          'mr snurfels',
          'lala',
          'lala',
          'lele',
          'lili',
          'lolo',
          'lulu',
        ],
      },
    ],
  })

  deepEqual(
    (
      await db
        .query('article')
        .filter('id', '>=', 3)
        .include('contributors.$tokens')
        .get()
    ).toObject(),
    [
      {
        id: 3,
        contributors: [
          {
            id: 1,
            $tokens: 7,
          },
        ],
      },
    ],
  )

  // handle undefined case
  deepEqual(
    await db
      .query('article')
      .filter('id', '>=', 3)
      .include('contributors.$undeftokens')
      .get()
      .toObject(),
    [
      {
        id: 3,
        contributors: [
          {
            id: 1,
          },
        ],
      },
    ],
  )

  // update without creation
  await db.update('article', edge, {
    contributors: [
      {
        id: mrSnurp,
        $undeftokens: xxHash64(ENCODER.encode('lala')),
      },
    ],
  })

  deepEqual(
    await db
      .query('article')
      .filter('id', '>=', 3)
      .include('contributors.$undeftokens')
      .get()
      .toObject(),
    [
      {
        id: 3,
        contributors: [
          {
            id: 1,
            $undeftokens: 1,
          },
        ],
      },
    ],
  )
})

await test('switches', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      store: {
        name: 'string',
        visitors: {
          type: 'cardinality',
          precision: 6,
          mode: 'dense',
        },
        visits: 'number',
      },
    },
  })

  const visits = ['Clint', 'Lee', 'Clint', 'Aldo', 'Lee']

  const store1 = db.create('store', {
    name: 'Handsome Sportsman',
    visitors: visits,
    visits: visits.length,
  })

  deepEqual(
    await db.query('store').include('visitors').get(),
    [
      {
        id: 1,
        visitors: 3,
      },
    ],
    'create with schema optionals (dense, prec=6)',
  )

  await db.update('store', store1, {
    visitors: 'Ennio',
  })

  await db.drain()

  deepEqual(
    await db.query('store').include('visitors').get(),
    [
      {
        id: 1,
        visitors: 4,
      },
    ],
    'update with schema optionals (dense, prec=6)',
  )
})

await test('defaultPrecision', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  await db.setSchema({
    props: {
      myRootCount: 'cardinality',
    },
    types: {
      stores: {
        name: 'string',
        customers: {
          items: {
            ref: 'customer',
            prop: 'customer',
          },
        },
      },
      customer: {
        name: 'string',
        productsBought: 'cardinality',
      },
    },
  })

  const cus = db.create('customer', {
    name: 'Alex Atala',
    productsBought: ['fork', 'knife', 'knife', 'frying pan'],
  })
  const sto = db.create('stores', {
    name: "Worderland's Kitchen",
    customers: [cus],
  })

  // await db.query('stores').include('*', '**').get().inspect()
})

await test('migrate + modify', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop())

  const analyticsEdition: SchemaType = {
    editionId: 'alias',
    uniqueUsers: 'cardinality',
  }
  const analyticsSession: SchemaType = {
    geo: { type: 'string', maxBytes: 2 },
    host: 'string',
  }

  await db.setSchema({
    types: {
      analyticsEdition,
      analyticsSession,
    },
  })

  const ed = db.create('analyticsEdition', {
    editionId: 'lala1',
    uniqueUsers: ['Mr. Lemonade', 'Ms. Mostard'],
  })
  const ss = db.create('analyticsSession', {
    geo: 'nl',
    host: 'http://192.168.1.1',
  })

  deepEqual(
    await db.query('analyticsEdition').include('uniqueUsers').get(),
    [{ id: 1, uniqueUsers: 2 }],
    'cardinality check',
  )

  // const lala = (
  //   await db
  //     .query('analyticsEdition')
  //     .include('uniqueUsers', { raw: true })
  //     .get()
  //     .toObject()
  // )[0].uniqueUsers

  // console.table(lala)
  // console.dir(lala, { maxArrayLength: null })

  const newAnalyticsSession: SchemaType = {
    geo: { type: 'string', maxBytes: 2 },
    host: 'string',
    editionId: 'uint32',
  }

  // await db.setSchema({
  //   types: {
  //     analyticsEdition,
  //     analyticsSession: newAnalyticsSession,
  //   },
  // })

  // const lala2 = (
  //   await db
  //     .query('analyticsEdition')
  //     .include('uniqueUsers', { raw: true })
  //     .get()
  //     .toObject()
  // )[0].uniqueUsers

  // // console.table(lala2)

  // This will crash https://linear.app/1ce/issue/FDN-1883
  db.update('analyticsEdition', ed, {
    editionId: 'lala1',
    uniqueUsers: ['Madam Satan'],
  })

  deepEqual(
    await db.query('analyticsEdition').include('uniqueUsers').get(),
    [{ id: 1, uniqueUsers: 3 }],
    'cardinality check',
  )
})
