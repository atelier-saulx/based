import { BasedDb } from '../../src/index.js'
import test from '../shared/test.js'
import { deepEqual } from '../shared/assert.js'
import { italy, sentence } from '../shared/examples.js'

await test('multiple references', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
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
              $friend: {
                ref: 'user',
              },
              $countries: {
                items: {
                  ref: 'country',
                },
              },
              $file: 'binary',
              $lang: 'string',
              $bigString: 'string',
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

  await db.drain()

  await db.create('article', {
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

  await db.create('article', {
    name: 'Italy',
    contributors: [
      {
        id: mrSnurp,
        $bigString: italy,
      },
    ],
  })

  deepEqual(
    (
      await db
        .query('article')
        .include('contributors.$role', 'contributors.$bigString')
        .get()
    ).toObject(),
    [
      {
        id: 1,
        contributors: [{ id: 1, $role: 'writer' }],
      },
      {
        id: 2,
        contributors: [{ id: 1, $bigString: italy }],
      },
    ],
  )

  deepEqual(
    (
      await db.query('article').include('contributors.$rating').get()
    ).toObject(),
    [
      {
        id: 1,
        contributors: [{ id: 1, $rating: 5 }],
      },
      {
        id: 2,
        contributors: [{ id: 1 }],
      },
    ],
  )

  deepEqual(
    (await db.query('article').include('contributors.$lang').get()).toObject(),
    [
      {
        id: 1,
        contributors: [{ id: 1, $lang: 'en' }],
      },
      {
        id: 2,
        contributors: [{ id: 1 }],
      },
    ],
  )

  deepEqual(
    (await db.query('article').include('contributors.$on').get()).toObject(),
    [
      {
        id: 1,
        contributors: [{ id: 1, $on: true }],
      },
      {
        id: 2,
        contributors: [{ id: 1 }],
      },
    ],
  )

  deepEqual(
    (await db.query('article').include('contributors.$file').get()).toObject(),
    [
      {
        id: 1,
        contributors: [{ id: 1, $file: new Uint8Array([1, 2, 3, 4]) }],
      },
      {
        id: 2,
        contributors: [{ id: 1 }],
      },
    ],
    'Buffer edge value',
  )

  let lastArticle = 0
  for (let i = 0; i < 3; i++) {
    lastArticle = await db.create('article', {
      name: 'The wonders of Strudel ' + i,
      contributors: [
        { id: mrYur, $role: 'editor', $rating: 5 },
        mrDerp,
        mrSnurp,
      ],
    })
  }

  deepEqual(
    (
      await db
        .query('article')
        .include((s) =>
          s('contributors').filter('$role', '=', 'writer').include('$role'),
        )
        .get()
    ).toObject(),
    [
      {
        id: 1,
        contributors: [
          {
            id: 1,
            $role: 'writer',
          },
        ],
      },
      { id: 2, contributors: [] },
      { id: 3, contributors: [] },
      { id: 4, contributors: [] },
      { id: 5, contributors: [] },
    ],
  )

  deepEqual(
    (
      await db
        .query('article')
        .include((s) =>
          s('contributors')
            .filter('$bigString', '=', italy)
            .include('$bigString'),
        )
        .get()
    ).toObject(),
    [
      {
        id: 1,
        contributors: [],
      },
      { id: 2, contributors: [{ id: 1, $bigString: italy }] },
      { id: 3, contributors: [] },
      { id: 4, contributors: [] },
      { id: 5, contributors: [] },
    ],
  )

  await db.update('article', lastArticle, {
    contributors: {
      update: [
        {
          id: mrYur,
          $rating: 2,
        },
      ],
    },
  })

  deepEqual(
    await db
      .query('article', lastArticle)
      .include('contributors.$rating')
      .get()
      .toObject(),
    {
      id: 5,
      contributors: [{ id: 2, $rating: 2 }, { id: 3 }, { id: 1 }],
    },
  )

  deepEqual(
    await db.query('article', 3).include('contributors.$countries.id').get(),
    {
      id: 3,
      contributors: [
        { id: 2, $countries: [] },
        { id: 3, $countries: [] },
        { id: 1, $countries: [] },
      ],
    },
  )

  for (let i = 0; i < 3; i++) {
    lastArticle = await db.create('article', {
      name: 'Totaly empty ' + i,
    })
  }

  deepEqual(
    await db
      .query('article')
      .include('contributors')
      .range(lastArticle - 3, 1000)
      .get(),
    [
      { id: 6, contributors: [] },
      { id: 7, contributors: [] },
      { id: 8, contributors: [] },
    ],
  )
})

await test('single reference', async (t) => {
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
          derp: 'uint8',
          articles: {
            items: {
              ref: 'article',
              prop: 'author',
            },
          },
        },
      },
      article: {
        props: {
          name: 'string',
          author: {
            type: 'reference',
            ref: 'user',
            prop: 'articles',
            $role: ['writer', 'editor', 'boss'],
            $on: 'boolean',
            $msg: 'string',
          },
        },
      },
    },
  })

  const mrDrol = await db.create('user', {
    name: 'Mr drol',
  })

  await db.create('article', {
    name: 'This is a nice article',
    author: { id: mrDrol, $role: 'boss' },
  })

  deepEqual(
    (await db.query('article').include('author.$role', '*').get()).toObject(),
    [
      {
        id: 1,
        name: 'This is a nice article',
        author: {
          id: 1,
          $role: 'boss',
        },
      },
    ],
  )

  await db.create('article', {
    name: 'This is a nice article with mr drol as writer',
    author: { id: mrDrol, $role: 'writer' },
  })

  deepEqual(
    (
      await db
        .query('article')
        .include('author.$role', '*')
        .filter('author.$role', '=', 'boss')
        .get()
    ).toObject(),
    [
      {
        id: 1,
        name: 'This is a nice article',
        author: {
          id: 1,
          $role: 'boss',
        },
      },
    ],
  )

  await db.create('article', {
    name: 'Power article',
    author: { id: mrDrol, $msg: sentence },
  })

  deepEqual(
    (await db.query('article').include('author.$msg', '*').get()).toObject(),
    [
      { id: 1, name: 'This is a nice article', author: { id: 1 } },
      {
        id: 2,
        name: 'This is a nice article with mr drol as writer',
        author: { id: 1 },
      },
      {
        id: 3,
        name: 'Power article',
        author: {
          id: 1,
          $msg: sentence,
        },
      },
    ],
  )
})

await test('preserve fields', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          bestFriend: {
            ref: 'user',
            prop: 'bestFriend',
            $x: 'uint16',
          },
          friends: {
            items: {
              ref: 'user',
              prop: 'friends',
              $x: 'uint16',
            },
          },
        },
      },
    },
  })

  const user1 = await db.create('user', {})
  const user2 = await db.create('user', {
    bestFriend: {
      id: user1,
      $x: 42,
    },
  })
  deepEqual(await db.query('user', user2).include('**').get(), {
    id: user2,
    bestFriend: {
      id: user1,
      $x: 42,
    },
    friends: [],
  })

  const user3 = await db.create('user', {
    bestFriend: { id: user2 },
    friends: [
      { id: user1, $x: 10 },
      { id: user2, $x: 20 },
    ],
  })
  deepEqual(await db.query('user', user1).include('**').get(), {
    id: user1,
    bestFriend: null,
    friends: [{ id: user3, $x: 10 }],
  })
  deepEqual(await db.query('user', user3).include('**').get(), {
    id: user3,
    bestFriend: {
      id: user2,
    },
    friends: [
      { id: user1, $x: 10 },
      { id: user2, $x: 20 },
    ],
  })

  await db.update('user', user3, {
    friends: { update: [{ id: user2, $index: 0 }] },
  })
  deepEqual(await db.query('user', user3).include('**').get(), {
    id: user3,
    bestFriend: { id: user2 },
    friends: [
      { id: user2, $x: 20 },
      { id: user1, $x: 10 },
    ],
  })
})
