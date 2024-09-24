import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual } from './shared/assert.js'

await test('simple', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  t.after(() => {
    return db.destroy()
  })

  await db.start({ clean: true })

  db.updateSchema({
    types: {
      user: {
        props: {
          flap: { type: 'uint32' },
          name: { type: 'string' },
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
          name: { type: 'string' },
          contributors: {
            items: {
              ref: 'user',
              prop: 'articles',
            },
          },
        },
      },
    },
  })

  const mrSnurp = db.create('user', {
    name: 'Mr snurp',
    flap: 10,
  })

  const flippie = db.create('user', {
    name: 'Flippie',
    flap: 20,
  })

  db.drain()

  const strudelArticle = db.create('article', {
    name: 'The wonders of Strudel',
    contributors: [mrSnurp],
  })

  const piArticle = db.create('article', {
    name: 'Apple Pie is a Lie',
    contributors: [mrSnurp, flippie],
  })

  db.drain()

  deepEqual(db.query('article').include('contributors.name').get().toObject(), [
    { id: strudelArticle, contributors: [{ id: mrSnurp, name: 'Mr snurp' }] },
    {
      id: piArticle,
      contributors: [
        { id: mrSnurp, name: 'Mr snurp' },
        { id: flippie, name: 'Flippie' },
      ],
    },
  ])

  deepEqual(db.query('user').include('articles.name').get().toObject(), [
    {
      id: 1,
      articles: [
        { id: 1, name: 'The wonders of Strudel' },
        { id: 2, name: 'Apple Pie is a Lie' },
      ],
    },
    { id: 2, articles: [{ id: 2, name: 'Apple Pie is a Lie' }] },
  ])
})

await test('one to many', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.updateSchema({
    types: {
      user: {
        props: {
          uid: { type: 'uint32' },
          name: { type: 'string' },
          resources: {
            items: {
              ref: 'resource',
              prop: 'owner',
            },
          },
        },
      },
      resource: {
        props: {
          type: { type: 'uint32' },
          name: { type: 'string' },
          owner: {
            ref: 'user',
            prop: 'resources',
          },
        },
      },
    },
  })

  const ownerId = db.create('user', {
    uid: 10,
    name: 'toor',
  })
  db.drain()

  for (let i = 0; i < 4; i++) {
    db.create('resource', {
      type: i % 2,
      name: `thing ${i}`,
      owner: ownerId,
    })
  }
  db.drain()

  deepEqual(db.query('user').include('resources').get().toObject(), [
    {
      id: 1,
      resources: [
        {
          id: 1,
          type: 0,
          name: 'thing 0',
        },
        {
          id: 2,
          type: 1,
          name: 'thing 1',
        },
        {
          id: 3,
          type: 0,
          name: 'thing 2',
        },
        {
          id: 4,
          type: 1,
          name: 'thing 3',
        },
      ],
    },
  ])

  deepEqual(db.query('user').include('resources.name').get().toObject(), [
    {
      id: 1,
      resources: [
        {
          id: 1,
          name: 'thing 0',
        },
        {
          id: 2,
          name: 'thing 1',
        },
        {
          id: 3,
          name: 'thing 2',
        },
        {
          id: 4,
          name: 'thing 3',
        },
      ],
    },
  ])
})

await test('update', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.updateSchema({
    types: {
      user: {
        props: {
          flap: { type: 'uint32' },
          name: { type: 'string' },
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
          name: { type: 'string' },
          contributors: {
            items: {
              ref: 'user',
              prop: 'articles',
            },
          },
        },
      },
    },
  })

  const mrSnurp = db.create('user', {
    name: 'Mr snurp',
    flap: 10,
  })

  const flippie = db.create('user', {
    name: 'Flippie',
    flap: 20,
  })

  db.drain()

  const strudelArticle = db.create('article', {
    name: 'The wonders of Strudel',
    contributors: [mrSnurp],
  })

  db.drain()

  db.update('article', strudelArticle, {
    contributors: [flippie],
  })

  db.drain()

  deepEqual(db.query('article').include('contributors.name').get().toObject(), [
    {
      id: 1,
      contributors: [
        {
          name: 'Flippie',
          id: flippie,
        },
      ],
    },
  ])
})

await test('filter', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  db.updateSchema({
    types: {
      user: {
        props: {
          flap: { type: 'uint32' },
          name: { type: 'string' },
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
          name: { type: 'string' },
          contributors: {
            items: {
              ref: 'user',
              prop: 'articles',
            },
          },
        },
      },
    },
  })

  const mrSnurp = db.create('user', {
    name: 'Mr snurp',
    flap: 10,
  })

  const flippie = db.create('user', {
    name: 'Flippie',
    flap: 20,
  })

  const derpie = db.create('user', {
    name: 'Derpie',
    flap: 30,
  })

  const dinkelDoink = db.create('user', {
    name: 'Dinkel Doink',
    flap: 40,
  })

  db.drain()

  const strudelArticle = db.create('article', {
    name: 'The wonders of Strudel',
    contributors: [mrSnurp, flippie, derpie, dinkelDoink],
  })

  db.drain()

  deepEqual(
    db
      .query('article', strudelArticle)
      .include('contributors')
      .get()
      .toObject(),
    {
      id: 1,
      contributors: [
        { id: 1, flap: 10, name: 'Mr snurp' },
        { id: 2, flap: 20, name: 'Flippie' },
        { id: 3, flap: 30, name: 'Derpie' },
        { id: 4, flap: 40, name: 'Dinkel Doink' },
      ],
    },
    'Get reference one get by id',
  )

  deepEqual(
    db
      .query('article', strudelArticle)
      .include((select) => {
        select('contributors').include('name').filter('flap', '>', 25)
      })
      .get()
      .toObject(),
    {
      id: 1,
      contributors: [
        { id: 3, name: 'Derpie' },
        { id: 4, name: 'Dinkel Doink' },
      ],
    },
    'Filter references',
  )

  deepEqual(
    db
      .query('article', strudelArticle)
      .include((select) => {
        select('contributors').include('flap')
        select('contributors').include('name')

        select('contributors').filter('flap', '>', 25)
        select('contributors').filter('flap', '<', 35)
      })
      .get()
      .toObject(),
    {
      id: 1,
      contributors: [{ id: 3, name: 'Derpie', flap: 30 }],
    },
    'Filter references multi select',
  )

  // deepEqual(
  //   db
  //     .query('article', strudelArticle)
  //     .include((select) => {
  //       select('contributors')
  //         .include('name')
  //         .include('flap')
  //         .filter('flap', '>', 25)
  //     })
  //     .get()
  //     .toObject(),
  //   {
  //     id: 1,
  //     contributors: [
  //       { id: 3, name: 'Derpie', flap: 30 },
  //       { id: 3, flap: 40, name: 'Dinkel Doink' },
  //     ],
  //   },
  //   'Filter references and sort',
  // )
})
