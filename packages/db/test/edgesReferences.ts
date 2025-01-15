import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('multi reference', async (t) => {
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
              $plonki: 'uint32',
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

  deepEqual(
    await db
      .query('article')
      .include('contributors.$age')
      .get()
      .then((v) => v.toObject()),
    [{ id: 1, contributors: [{ id: 1, $age: 66 }] }],
  )

  deepEqual(
    await db
      .query('article')
      .include('contributors.$friend.name', 'contributors.$friend.location')
      .get()
      .then((v) => v.debug().toObject()),
    [
      {
        id: 1,
        contributors: [
          {
            id: 1,
            $friend: { id: 5, location: { long: 0, lat: 0 }, name: 'Mr Derp3' },
          },
        ],
      },
    ],
  )

  deepEqual(
    await db
      .query('article')
      .include('contributors.$friend')
      .get()
      .then((v) => v.debug().inspect().toObject()),
    [
      {
        id: 1,
        contributors: [
          {
            id: 1,
            $friend: {
              id: 5,
              location: { long: 0, lat: 0 },
              name: 'Mr Derp3',
              email: '',
              smurp: '',
            },
          },
        ],
      },
    ],
  )
})

await test('multiple references', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  t.after(() => {
    return db.destroy()
  })

  await db.start({ clean: true })

  db.putSchema({
    types: {
      country: {
        props: {
          code: { type: 'string', maxBytes: 2 },
          name: 'string',
        },
      },
      user: {
        props: {
          name: 'string',
          articles: {
            items: {
              ref: 'article',
              prop: 'contributors',
            },
          },
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

  const uk = await db.create('country', {
    name: 'United Kingdom',
    code: 'uk',
  })

  const de = await db.create('country', {
    name: 'Germany',
    code: 'de',
  })

  const mrDerp = await db.create('user', {
    name: 'Mr Derp',
  })

  await db.create('article', {
    name: 'The wonders of Strudel',
    contributors: [
      {
        id: mrDerp,
        $countries: [uk, de],
      },
    ],
  })

  console.dir(
    await db
      .query('article')
      .include('contributors.name', 'contributors.$countries')
      .get()
      .then((v) => v.debug().toObject()),
    { depth: 10 },
  )
})
