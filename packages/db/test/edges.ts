import { BasedDb } from '../src/index.js'
import test from './shared/test.js'

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
              $role: ['writer', 'editor'],
              // $rating: 'uint32',
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
        $role: 'writer',
      },
    ],
  })

  db.drain()

  const x = db
    .query('article')
    // .include('name')
    // .include('contributors.$role')
    // .include('contributors.$rating')
    // .include('contributors.$email')
    // .include('contributors.$lang')
    // .include('contributors.$friend')
    .include('contributors.$role')
    // .include('contributors.$countries')
    .get()

  x.debug()

  console.log(x)
})
