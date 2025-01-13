import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('references', async (t) => {
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
              $derp: 'uint8',
              $age: 'uint32',
              $friend: {
                ref: 'user',
              },
              $countries: {
                items: {
                  ref: 'country',
                },
              },
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

  const mrDerp2 = db.create('user', {
    name: 'Mr Derp2',
  })

  const mrDerp3 = db.create('user', {
    name: 'Mr Derp3',
  })

  db.drain()

  await db.create('article', {
    name: 'The wonders of Strudel',
    contributors: [
      {
        id: mrSnurp,
        $friend: mrDerp3, // id 5
        $derp: 99,
        $age: 66,
      },
    ],
  })

  // single ref
  // console.log(
  //   new Uint8Array(
  //     await db.query('article').include('contributors.$derp').toBuffer(),
  //   ),
  // )

  await db
    .query('article')
    .include('contributors.$age')
    .get()
    .then((v) => v.debug())

  await db
    .query('article')
    .include('contributors.$friend')
    .get()
    .then((v) => v.debug())
})
