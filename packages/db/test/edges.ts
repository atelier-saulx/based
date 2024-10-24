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
              $lang: 'string',
              $role: ['writer', 'editor'],
              $rating: 'uint32',
              // $price: ['mep', 'map'],
              // $email: 'string',
            },
          },
        },
      },
    },
  })

  const mrSnurp = db.create('user', {
    name: 'Mr snurp',
  })

  const mrYur = db.create('user', {
    name: 'Mr Yur',
  })

  const nl = db.create('country', {
    name: 'Netherlands',
    code: 'nl',
  })

  db.drain()

  const strudelArticle = db.create('article', {
    name: 'The wonders of Strudel',
    contributors: [
      {
        id: mrSnurp,
        $lang: 'en',
        $rating: 5,
        $role: 'writer',
        // $lang: 'en',
      },
    ],
  })

  db.drain()

  const x = db.query('article').include('contributors.$role').get()

  x.debug()

  deepEqual(x.toObject(), [
    {
      id: 1,
      contributors: [{ id: 1, $role: 'writer' }],
    },
  ])

  const y = db.query('article').include('contributors.$rating').get()

  y.debug()

  deepEqual(y.toObject(), [
    {
      id: 1,
      contributors: [{ id: 1, $rating: 5 }],
    },
  ])
})
