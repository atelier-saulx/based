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

  await db.putSchema({
    types: {
      user: {
        props: {
          flap: 'uint32',
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

  await db.drain()

  const strudelArticle = db.create('article', {
    name: 'The wonders of Strudel',
    contributors: [mrSnurp],
  })

  const piArticle = db.create('article', {
    name: 'Apple Pie is a Lie',
    contributors: [mrSnurp, flippie],
  })

  await db.drain()

  deepEqual(
    (await db.query('article').include('contributors.name').get()).toObject(),
    [
      {
        id: strudelArticle.tmpId,
        contributors: [{ id: mrSnurp.tmpId, name: 'Mr snurp' }],
      },
      {
        id: piArticle.tmpId,
        contributors: [
          { id: mrSnurp.tmpId, name: 'Mr snurp' },
          { id: flippie.tmpId, name: 'Flippie' },
        ],
      },
    ],
  )

  deepEqual(
    (await db.query('user').include('articles.name').get()).toObject(),
    [
      {
        id: 1,
        articles: [
          { id: 1, name: 'The wonders of Strudel' },
          { id: 2, name: 'Apple Pie is a Lie' },
        ],
      },
      { id: 2, articles: [{ id: 2, name: 'Apple Pie is a Lie' }] },
    ],
  )
})

await test('one to many', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
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
  await db.drain()

  for (let i = 0; i < 4; i++) {
    db.create('resource', {
      type: i % 2,
      name: `thing ${i}`,
      owner: ownerId,
    })
  }
  await db.drain()

  deepEqual((await db.query('user').include('resources').get()).toObject(), [
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

  deepEqual(
    (await db.query('user').include('resources.name').get()).toObject(),
    [
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
    ],
  )
})

await test('update', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
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

  await db.drain()

  const strudelArticle = db.create('article', {
    name: 'The wonders of Strudel',
    contributors: [mrSnurp],
  })

  await db.drain()

  db.update('article', strudelArticle, {
    contributors: [flippie],
  })

  await db.drain()

  deepEqual(
    (await db.query('article').include('contributors.name').get()).toObject(),
    [
      {
        id: 1,
        contributors: [
          {
            name: 'Flippie',
            id: +flippie,
          },
        ],
      },
    ],
  )
})

await test('filter', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
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

  await db.drain()

  const strudelArticle = db.create('article', {
    name: 'The wonders of Strudel',
    contributors: [mrSnurp, flippie, derpie, dinkelDoink],
  })

  await db.drain()

  deepEqual(
    (
      await db.query('article', strudelArticle).include('contributors').get()
    ).toObject(),
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
    (
      await db
        .query('article', strudelArticle)
        .include((q) =>
          q('contributors').include('name').filter('flap', '>', 25),
        )
        .get()
    ).toObject(),
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
    (
      await db
        .query('article', strudelArticle)
        .include((q) => {
          q('contributors').include('flap')
          q('contributors').include('name')
          q('contributors').filter('flap', '>', 25)
          q('contributors').filter('flap', '<', 35)
        })
        .get()
    ).toObject(),
    {
      id: 1,
      contributors: [{ id: 3, name: 'Derpie', flap: 30 }],
    },
    'Filter references multi select',
  )

  deepEqual(
    (
      await db
        .query('article', strudelArticle)
        .include((select) => {
          select('contributors')
            .include('name')
            .include('flap')
            .filter('flap', '>', 25)
            .sort('flap', 'desc')
        })
        .get()
    ).toObject(),
    {
      id: 1,
      contributors: [
        { id: 4, name: 'Dinkel Doink', flap: 40 },
        { id: 3, name: 'Derpie', flap: 30 },
      ],
    },
    'Filter references and sort',
  )
})

await test('cross reference', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => {
    return db.destroy()
  })

  await db.putSchema({
    locales: {
      en: { required: true },
      // fr: { required: true },
      // nl: { required: true },
      // el: { required: true },
      // he: { required: true },
      // it: { required: true },
      // lv: { required: true },
      // lb: { required: true },
      // ro: { required: true },
      // sl: { required: true },
      // es: { required: true },
      // de: { required: true },
      // cs: { required: true },
      // et: { required: true },
    },
    // props: {
    //   info: 'text',
    //   legal: 'text',
    //   terms: 'text',
    //   privacy: 'text',
    //   excludedCountries: { items: { ref: 'country' } },
    //   activeSequence: { ref: 'sequence' },
    //   coreDataLock: 'boolean',
    // },
    types: {
      country: {
        name: 'string',
        currency: [
          'all',
          'amd',
          'aud',
          'azn',
          'chf',
          'czk',
          'dkk',
          'eur',
          'gbp',
          'gel',
          'ils',
          'isk',
          'mdl',
          'nok',
          'pln',
          'rsd',
          'sek',
          'uah',
        ],
        voteType: ['sms_text', 'sms_suffix', 'online', 'call_suffix'],
        maxVotes: { type: 'uint8' },
        price: 'uint16',
        destination: 'string',
        votingText: 'text',
        votingLegal: 'text',
      },
      // sequence: {
      //   name: { type: 'string', readOnly: true },
      //   recapTitle: 'text',
      //   title: 'text',
      //   description: 'text',
      //   countdown: 'timestamp',
      //   winner: 'string',
      //   row: {
      //     props: { title: 'text', description: 'text', countdown: 'timestamp' },
      //   },
      // },
      // round: {
      //   name: 'string',
      //   contestants: { items: { ref: 'contestant', prop: 'rounds' } },
      //   createdBy: { ref: 'user', prop: 'createdRounds' },
      // },
      contestant: {
        name: 'string',
        song: 'string',
        lyrics: 'string',
        country: { ref: 'country', prop: 'contestants' },
      },
      // user: {
      //   name: 'string',
      //   email: { type: 'alias', format: 'email' },
      //   currentToken: 'alias',
      // },
    },
  })

  const contestant1 = await db.create('contestant')
  const contestant2 = await db.create('contestant')
  const country1 = await db.create('country')
  await db.update('contestant', contestant1, {
    name: 'New contestant',
    country: country1,
  })
  console.log('--------')
  console.dir(
    await db.query('contestant').include('*', 'country').get().toObject(),
    {
      depth: null,
    },
  )
})
