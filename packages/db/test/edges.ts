import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('edges', async (t) => {
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
          email: 'string',
          name: 'string',
          smurp: 'string',
          articles: {
            items: {
              ref: 'article',
              prop: 'contributors',
            },
          },
          location: {
            props: {
              long: 'number',
              lat: 'number',
            },
          },
        },
      },
      country: {
        props: {
          code: { type: 'string', maxBytes: 2 },
          name: 'string',
        },
      },
      article: {
        props: {
          name: 'string',
          contributors: {
            type: 'references',
            items: {
              ref: 'user',
              prop: 'articles',
              // $friend: {
              //   ref: 'user',
              // },
              // $countries: {
              //   items: {
              //     ref: 'country',
              //   },
              // },
              $file: 'binary',
              $lang: 'string',
              $role: ['writer', 'editor'],
              $rating: 'uint32',
              $on: 'boolean',
            },
          },
        },
      },
    },
  })

  const mrSnurp = db.create('user', {
    name: 'Mr snurp',
    location: {
      long: 42.12,
      lat: 32.14,
    },
  })

  const mrYur = db.create('user', {
    name: 'Mr Yur',
  })

  const mrDerp = db.create('user', {
    name: 'Mr Derp',
  })

  db.drain()

  const strudel = await db.create('article', {
    name: 'The wonders of Strudel',
    contributors: [
      {
        id: mrSnurp,
        $lang: 'en',
        $rating: 5,
        $role: 'writer',
        $on: true,
        $file: new Uint8Array([1, 2, 3, 4]),
      },
    ],
  })

  deepEqual(
    db.query('article').include('contributors.$role').get().toObject(),
    [
      {
        id: 1,
        contributors: [{ id: 1, $role: 'writer' }],
      },
    ],
  )

  deepEqual(
    db.query('article').include('contributors.$rating').get().toObject(),
    [
      {
        id: 1,
        contributors: [{ id: 1, $rating: 5 }],
      },
    ],
  )

  deepEqual(
    db.query('article').include('contributors.$lang').get().toObject(),
    [
      {
        id: 1,
        contributors: [{ id: 1, $lang: 'en' }],
      },
    ],
  )

  deepEqual(db.query('article').include('contributors.$on').get().toObject(), [
    {
      id: 1,
      contributors: [{ id: 1, $on: true }],
    },
  ])

  deepEqual(
    db.query('article').include('contributors.$file').get().toObject(),
    [
      {
        id: 1,
        contributors: [{ id: 1, $file: new Uint8Array([1, 2, 3, 4]) }],
      },
    ],
  )

  for (let i = 0; i < 3; i++) {
    await db.create('article', {
      name: 'The wonders of Strudel ' + i,
      contributors: [mrYur, mrDerp, mrSnurp],
    })
  }

  const x = db
    .query('article')
    .include('contributors.*', 'contributors.$role', '*')
    .get()

  console.log(x)
})
