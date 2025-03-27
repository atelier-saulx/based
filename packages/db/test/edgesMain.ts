import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('multiple', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  t.after(() => {
    return t.backup(db)
  })

  await db.start({ clean: true })

  await db.setSchema({
    types: {
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
              $rating: 'uint32',
              $derp: 'string',
              $rdy: 'boolean',
            },
          },
        },
      },
    },
  })

  const mrDerp = await db.create('user', { name: 'mr Derp' })
  const mrFrap = await db.create('user', { name: 'mr Frap' })

  const fantasticalFriday = await db.create('article', {
    name: 'Fantastical Friday',
    contributors: [
      {
        id: mrDerp,
        $rdy: true,
        $rating: 66,
        $derp: 'a',
      },
      {
        id: mrFrap,
        $rdy: true,
        $derp: 'b',
      },
    ],
  })

  deepEqual(
    await db
      .query('article')
      .include('contributors.$rdy')
      .include('contributors.$rating')
      .include('contributors.$derp')
      .get()
      .toObject(),
    [
      {
        id: 1,
        contributors: [
          {
            id: 1,
            $rating: 66,
            $rdy: true,
            $derp: 'a',
          },
          {
            id: 2,
            $rating: 0,
            $rdy: true,
            $derp: 'b',
          },
        ],
      },
    ],
  )

  await db.update('article', fantasticalFriday, {
    contributors: {
      set: [
        {
          id: mrDerp,
          $rating: 22,
          // $rdy: true,
        },
      ],
    },
  })

  deepEqual(
    await db
      .query('article')
      .include('name')
      .include('contributors.$rdy')
      .include('contributors.$rating')
      .include('contributors.$derp')
      .get()
      .toObject(),
    [
      {
        id: 1,
        name: 'Fantastical Friday',
        contributors: [
          {
            id: 1,
            $rating: 22,
            $rdy: true,
            $derp: 'a',
          },
          {
            id: 2,
            $rating: 0,
            $rdy: true,
            $derp: 'b',
          },
        ],
      },
    ],
  )

  await db.create('article', {
    name: 'Typical Thursday',
    contributors: [
      {
        id: mrDerp,
        $rating: 1,
      },
    ],
  })

  deepEqual(
    (
      await db
        .query('article')
        .include('name')
        .include('contributors.$rdy')
        .include('contributors.$rating')
        .include('contributors.$derp')
        .get()
    ).toObject(),
    [
      {
        id: 1,
        name: 'Fantastical Friday',
        contributors: [
          { id: 1, $rating: 22, $rdy: true, $derp: 'a' },
          { id: 2, $rating: 0, $rdy: true, $derp: 'b' },
        ],
      },
      {
        id: 2,
        name: 'Typical Thursday',
        contributors: [{ id: 1, $rating: 1, $rdy: false }],
      },
    ],
  )

  await db.update('article', fantasticalFriday, {
    contributors: {
      set: [
        {
          id: mrDerp,
          $rating: { increment: 1 },
        },
      ],
    },
  })

  deepEqual(
    (
      await db
        .query('article')
        .include('name')
        .include('contributors.$rdy')
        .include('contributors.$rating')
        .include('contributors.$derp')
        .get()
    ).toObject(),
    [
      {
        id: 1,
        name: 'Fantastical Friday',
        contributors: [
          { id: 1, $rating: 23, $rdy: true, $derp: 'a' },
          { id: 2, $rating: 0, $rdy: true, $derp: 'b' },
        ],
      },
      {
        id: 2,
        name: 'Typical Thursday',
        contributors: [{ id: 1, $rating: 1, $rdy: false }],
      },
    ],
  )
})

await test('single', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  t.after(() => {
    return t.backup(db)
  })

  await db.start({ clean: true })

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
      article: {
        props: {
          name: 'string',
          contributor: {
            type: 'reference',
            ref: 'user',
            prop: 'articles',
            $rating: 'uint32',
            $derp: 'string',
            $rdy: 'boolean',
          },
        },
      },
    },
  })

  const mrDerp = await db.create('user', { name: 'mr Derp' })

  await db.create('article', {
    name: 'Fantastical Friday',
    contributor: {
      id: mrDerp,
      $rdy: true,
      $rating: 66,
      $derp: 'a',
    },
  })

  deepEqual(
    await db
      .query('article')
      .include('contributor.$rdy')
      .include('contributor.$rating')
      .include('contributor.$derp')
      .get()
      .toObject(),
    [
      {
        id: 1,
        contributor: {
          id: 1,
          $rating: 66,
          $rdy: true,
          $derp: 'a',
        },
      },
    ],
  )

  deepEqual(
    await db.query('article').include('contributor.$rdy').get().toObject(),
    [
      {
        id: 1,
        contributor: {
          id: 1,
          $rdy: true,
        },
      },
    ],
  )
})

await test('manyFields', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  t.after(() => {
    return t.backup(db)
  })

  await db.start({ clean: true })

  await db.setSchema({
    types: {
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
              $derp: 'uint8',
              $age: 'uint32',
              $plonki: 'uint32',
            },
          },
        },
      },
    },
  })

  const mrSnurp = db.create('user', {
    name: 'Mr snurp',
  })

  const mrDerp3 = db.create('user', {
    name: 'Mr Derp3',
  })

  await db.drain()

  await db.create('article', {
    name: 'The wonders of Strudel',
    contributors: [
      {
        id: mrSnurp,
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
    'age 66',
  )
})
