import { BasedDb, xxHash64 } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

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

  console.log('++++')

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

  console.log('----- edges -----')
  const edge = await db.create('article', {
    derp: 813,
    contributors: [{ id: mrSnurp, $tokens: ['lala', 'lele', 'lili'] }],
  })
  console.log('----- edges end -----')

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
