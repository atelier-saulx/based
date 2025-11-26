import { BasedDb } from '../../src/index.js'
import test from '../shared/test.js'
import { deepEqual } from '../shared/assert.js'

await test('multi reference', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          name: 'string',
          articles: {
            items: {
              ref: 'article',
              prop: 'contributor',
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
          contributor: {
            ref: 'user',
            prop: 'articles',
            $friend: {
              ref: 'user',
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

  await db.drain()

  const strudel = await db.create('article', {
    name: 'The wonders of Strudel',
    contributor: {
      id: mrSnurp,
      $friend: mrYur, // id 5
    },
  })

  deepEqual(
    await db.query('article').include('contributor.$friend').get().toObject(),
    [
      {
        id: 1,
        contributor: { id: 1, $friend: { id: 2, name: 'Mr Yur' } },
      },
    ],
  )
})

await test('multiple references', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
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
              prop: 'contributor',
            },
          },
        },
      },
      article: {
        props: {
          name: 'string',
          contributor: {
            type: 'reference',
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
    contributor: {
      id: mrDerp,
      $countries: [uk, de],
    },
  })

  await db.create('article', {
    name: 'The secrets of sourkraut',
    contributor: {
      id: mrFlap,
      $countries: [nl, de],
    },
  })

  deepEqual(
    await db
      .query('article')
      .include('name', 'contributor.$countries')
      .get()
      .then((v) => v.toObject()),
    [
      {
        id: 1,
        name: 'The wonders of Strudel',
        contributor: {
          id: 1,
          $countries: [
            { id: 1, code: 'uk', name: 'United Kingdom' },
            { id: 2, code: 'de', name: 'Germany' },
          ],
        },
      },
      {
        id: 2,
        name: 'The secrets of sourkraut',
        contributor: {
          id: 2,
          $countries: [
            { id: 3, code: 'nl', name: 'Netherlands' },
            { id: 2, code: 'de', name: 'Germany' },
          ],
        },
      },
    ],
  )

  // this tests offsets
  let i = 10
  while (i--) {
    db.create('article', {
      name: 'The secrets of sourkraut',
      contributor: {
        id: mrFlap,
        $countries: [nl, de],
      },
    })
  }
  await db.drain()
  const articles = (
    await db
      .query('article')
      .include('name', 'contributor.$countries')
      .get()
      .toObject()
  ).slice(-10)

  for (const article of articles) {
    deepEqual(article, {
      id: article.id,
      name: 'The secrets of sourkraut',
      contributor: {
        id: 2,
        $countries: [
          { id: 3, code: 'nl', name: 'Netherlands' },
          { id: 2, code: 'de', name: 'Germany' },
        ],
      },
    })
  }
})
