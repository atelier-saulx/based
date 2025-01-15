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
      .then((v) => v.toObject()),
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
      .then((v) => v.toObject()),
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
          users: { items: { ref: 'user', prop: 'nationality' } },
        },
      },
      user: {
        props: {
          name: 'string',
          nationality: { ref: 'country', prop: 'users' },
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

  const nl = await db.create('country', {
    name: 'Netherlands',
    code: 'nl',
  })

  const mrDerp = await db.create('user', {
    name: 'Mr Derp',
    nationality: nl,
  })

  const mrFlap = await db.create('user', {
    name: 'Mr Falp',
    nationality: de,
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

  await db.create('article', {
    name: 'The secrets of sourkraut',
    contributors: [
      {
        id: mrFlap,
        $countries: [nl, de],
      },
    ],
  })

  deepEqual(
    await db
      .query('article')
      .include('contributors.id')
      .get()
      .then((v) => v.toObject()),
    [
      { id: 1, contributors: [{ id: mrDerp }] },
      { id: 2, contributors: [{ id: mrFlap }] },
    ],
  )

  deepEqual(
    await db
      .query('article')
      .include('contributors.id', 'contributors.$countries.id')
      .get()
      .then((v) => v.toObject()),
    [
      {
        id: 1,
        contributors: [{ id: mrDerp, $countries: [{ id: 1 }, { id: 2 }] }],
      },
      {
        id: 2,
        contributors: [{ id: mrFlap, $countries: [{ id: 3 }, { id: 2 }] }],
      },
    ],
  )

  deepEqual(
    await db
      .query('article')
      .include('contributors.id', 'contributors.$countries.code')
      .get()
      .then((v) => v.toObject()),
    [
      {
        id: 1,
        contributors: [
          {
            id: mrDerp,
            $countries: [
              { id: 1, code: 'uk' },
              { id: 2, code: 'de' },
            ],
          },
        ],
      },
      {
        id: 2,
        contributors: [
          {
            id: mrFlap,
            $countries: [
              { id: 3, code: 'nl' },
              { id: 2, code: 'de' },
            ],
          },
        ],
      },
    ],
  )

  deepEqual(
    await db
      .query('article')
      .include('contributors.id', 'contributors.$countries')
      .get()
      .then((v) => v.toObject()),
    [
      {
        id: 1,
        contributors: [
          {
            id: mrDerp,
            $countries: [
              { id: 1, code: 'uk', name: 'United Kingdom' },
              { id: 2, code: 'de', name: 'Germany' },
            ],
          },
        ],
      },
      {
        id: 2,
        contributors: [
          {
            id: mrFlap,
            $countries: [
              { id: 3, code: 'nl', name: 'Netherlands' },
              { id: 2, code: 'de', name: 'Germany' },
            ],
          },
        ],
      },
    ],
  )

  deepEqual(
    await db
      .query('article')
      .include((t) => {
        t('contributors').include('$countries').include('name').sort('name')
      })
      .get()
      .then((v) => v.toObject()),
    [
      {
        id: 1,
        contributors: [
          {
            id: 1,
            $countries: [
              { id: 1, code: 'uk', name: 'United Kingdom' },
              { id: 2, code: 'de', name: 'Germany' },
            ],
            name: 'Mr Derp',
          },
        ],
      },
      {
        id: 2,
        contributors: [
          {
            id: 2,
            $countries: [
              { id: 3, code: 'nl', name: 'Netherlands' },
              { id: 2, code: 'de', name: 'Germany' },
            ],
            name: 'Mr Falp',
          },
        ],
      },
    ],
  )

  deepEqual(
    await db
      .query('article')
      .include((t) => {
        t('contributors').include('name').filter('nationality', '=', nl)
      })
      .get()
      .then((v) => v.toObject()),
    [
      {
        id: 1,
        contributors: [
          {
            id: 1,
            name: 'Mr Derp',
          },
        ],
      },
      {
        id: 2,
        contributors: [],
      },
    ],
  )

  deepEqual(
    await db
      .query('article')
      .include((t) => {
        t('contributors')
          .include('name')
          .include('$countries')
          .sort('name')
          .filter('nationality', '=', nl)
      })
      .get()
      .then((v) => v.toObject()),
    [
      {
        id: 1,
        contributors: [
          {
            id: 1,
            name: 'Mr Derp',
            $countries: [
              { id: 1, code: 'uk', name: 'United Kingdom' },
              { id: 2, code: 'de', name: 'Germany' },
            ],
          },
        ],
      },
      {
        id: 2,
        contributors: [],
      },
    ],
  )

  deepEqual(
    await db
      .query('article')
      .include((s) => {
        s('contributors')
          .include('name')
          .include((s) => {
            s('$countries').include('code')
          })
          .sort('name')
          .filter('nationality', '=', nl)
      })
      .get()
      .then((v) => v.toObject()),
    [
      {
        id: 1,
        contributors: [
          {
            id: 1,
            name: 'Mr Derp',
            $countries: [
              { id: 1, code: 'uk' },
              { id: 2, code: 'de' },
            ],
          },
        ],
      },
      { id: 2, contributors: [] },
    ],
  )

  deepEqual(
    await db
      .query('article')
      .include((s) => {
        s('contributors')
          .include('name')
          .include((s) => {
            s('$countries').include('code').filter('code', '=', 'de')
          })
          .sort('name')
          .filter('nationality', '=', nl)
      })
      .get()
      .then((v) => v.toObject()),
    [
      {
        id: 1,
        contributors: [
          {
            id: 1,
            name: 'Mr Derp',
            $countries: [{ id: 2, code: 'de' }],
          },
        ],
      },
      { id: 2, contributors: [] },
    ],
  )
})
