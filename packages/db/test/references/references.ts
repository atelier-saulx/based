import { BasedDb } from '../../src/index.ts'
import test from '../shared/test.ts'
import { deepEqual } from '../shared/assert.ts'
import { wait } from '@based/utils'

await test('references', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  t.after(() => t.backup(db))
  await db.start({ clean: true })

  await db.setSchema({
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
        id: await strudelArticle,
        contributors: [{ id: await mrSnurp, name: 'Mr snurp' }],
      },
      {
        id: await piArticle,
        contributors: [
          { id: await mrSnurp, name: 'Mr snurp' },
          { id: await flippie, name: 'Flippie' },
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
  t.after(() => t.backup(db))

  await db.setSchema({
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

await test('one to many really', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      user: {
        props: {
          name: { type: 'string', max: 8 },
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
          name: { type: 'string', max: 8 },
          owner: {
            ref: 'user',
            prop: 'resources',
          },
        },
      },
    },
  })

  const cpu = db.create('resource', { name: 'cpu' })
  const kbd = db.create('resource', { name: 'keyboard' })
  const mouse = db.create('resource', { name: 'mouse' })
  const fd = db.create('resource', { name: 'floppy' })
  const user = db.create('user', {
    name: 'root',
    resources: [cpu, kbd, mouse, fd],
  })
  await db.drain()
  deepEqual(
    await db.query('user', user).include('resources').get().toObject(),
    {
      id: 1,
      resources: [
        {
          id: 1,
          name: 'cpu',
        },
        {
          id: 2,
          name: 'keyboard',
        },
        {
          id: 3,
          name: 'mouse',
        },
        {
          id: 4,
          name: 'floppy',
        },
      ],
    },
  )
  await db.update('user', user, {
    resources: [cpu, kbd, mouse],
  })
  deepEqual(
    await db.query('user', user).include('resources').get().toObject(),
    {
      id: 1,
      resources: [
        {
          id: 1,
          name: 'cpu',
        },
        {
          id: 2,
          name: 'keyboard',
        },
        {
          id: 3,
          name: 'mouse',
        },
      ],
    },
  )

  await db.update('user', user, {
    resources: [cpu, kbd, mouse],
  })
  deepEqual(
    await db.query('user', user).include('resources').get().toObject(),
    {
      id: 1,
      resources: [
        {
          id: 1,
          name: 'cpu',
        },
        {
          id: 2,
          name: 'keyboard',
        },
        {
          id: 3,
          name: 'mouse',
        },
      ],
    },
  )

  await db.update('user', user, {
    resources: [cpu, kbd, mouse, fd],
  })
  deepEqual(
    await db.query('user', user).include('resources').get().toObject(),
    {
      id: 1,
      resources: [
        {
          id: 1,
          name: 'cpu',
        },
        {
          id: 2,
          name: 'keyboard',
        },
        {
          id: 3,
          name: 'mouse',
        },
        {
          id: 4,
          name: 'floppy',
        },
      ],
    },
  )

  await db.update('user', user, {
    resources: [kbd, cpu, fd, mouse],
  })
  deepEqual(
    await db.query('user', user).include('resources').get().toObject(),
    {
      id: 1,
      resources: [
        {
          id: 2,
          name: 'keyboard',
        },
        {
          id: 1,
          name: 'cpu',
        },
        {
          id: 4,
          name: 'floppy',
        },
        {
          id: 3,
          name: 'mouse',
        },
      ],
    },
  )

  const joy = await db.create('resource', { name: 'joystick', owner: user })
  await db.update('resource', joy, { owner: user })
  await db.update('resource', joy, { owner: user })
  await db.update('resource', joy, { owner: user })
  deepEqual(
    await db.query('user', user).include('resources').get().toObject(),
    {
      id: 1,
      resources: [
        {
          id: 2,
          name: 'keyboard',
        },
        {
          id: 1,
          name: 'cpu',
        },
        {
          id: 4,
          name: 'floppy',
        },
        {
          id: 3,
          name: 'mouse',
        },
        {
          id: 5,
          name: 'joystick',
        },
      ],
    },
  )

  await db.update('user', user, {
    resources: [kbd, cpu, fd, mouse],
  })
  await db.update('user', user, {
    resources: {
      update: [joy],
    },
  })
  deepEqual(
    await db.query('user', user).include('resources').get().toObject(),
    {
      id: 1,
      resources: [
        {
          id: 2,
          name: 'keyboard',
        },
        {
          id: 1,
          name: 'cpu',
        },
        {
          id: 4,
          name: 'floppy',
        },
        {
          id: 3,
          name: 'mouse',
        },
        {
          id: 5,
          name: 'joystick',
        },
      ],
    },
  )

  await db.update('user', user, {
    resources: {
      update: [joy, kbd, cpu, fd, mouse],
    },
  })
  deepEqual(
    await db.query('user', user).include('resources').get().toObject(),
    {
      id: 1,
      resources: [
        {
          id: 2,
          name: 'keyboard',
        },
        {
          id: 1,
          name: 'cpu',
        },
        {
          id: 4,
          name: 'floppy',
        },
        {
          id: 3,
          name: 'mouse',
        },
        {
          id: 5,
          name: 'joystick',
        },
      ],
    },
  )
})

await test('update', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
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
            id: await flippie,
          },
        ],
      },
    ],
  )
  await wait(1000)
})

await test('filter', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
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

// await test('cross reference', async (t) => {
//   const db = new BasedDb({
//     path: t.tmp,
//   })

//   await db.start({ clean: true })

//   t.after(() =>db.destroy())

//   await db.setSchema({
//     locales: {
//       en: { required: true },
//       fr: { required: true },
//       nl: { required: true },
//       el: { required: true },
//       he: { required: true },
//       it: { required: true },
//       lv: { required: true },
//       lb: { required: true },
//       ro: { required: true },
//       sl: { required: true },
//       es: { required: true },
//       de: { required: true },
//       cs: { required: true },
//       et: { required: true },
//     },
//     props: {
//       info: 'text',
//       legal: 'text',
//       terms: 'text',
//       privacy: 'text',
//       excludedCountries: { items: { ref: 'country' } },
//       activeSequence: { ref: 'sequence' },
//       coreDataLock: 'boolean',
//     },
//     types: {
//       country: {
//         name: 'string',
//         currency: [
//           'all',
//           'amd',
//           'aud',
//           'azn',
//           'chf',
//           'czk',
//           'dkk',
//           'eur',
//           'gbp',
//           'gel',
//           'ils',
//           'isk',
//           'mdl',
//           'nok',
//           'pln',
//           'rsd',
//           'sek',
//           'uah',
//         ],
//         voteType: ['sms_text', 'sms_suffix', 'online', 'call_suffix'],
//         maxVotes: { type: 'uint8' },
//         price: 'uint16',
//         destination: 'string',
//         votingText: 'text',
//         votingLegal: 'text',
//       },
//       sequence: {
//         name: { type: 'string', readOnly: true },
//         recapTitle: 'text',
//         title: 'text',
//         description: 'text',
//         countdown: 'timestamp',
//         winner: 'string',
//         row: {
//           props: { title: 'text', description: 'text', countdown: 'timestamp' },
//         },
//       },
//       round: {
//         name: 'string',
//         contestants: { items: { ref: 'contestant', prop: 'rounds' } },
//         createdBy: { ref: 'user', prop: 'createdRounds' },
//       },
//       contestant: {
//         name: 'string',
//         song: 'string',
//         lyrics: 'string',
//         country: { ref: 'country', prop: 'contestants' },
//       },
//       user: {
//         name: 'string',
//         email: { type: 'alias', format: 'email' },
//         currentToken: 'alias',
//       },
//     },
//   })

//   console.dir(
//     await db.query('contestant').include('*', '**').get().toObject(),
//     {
//       depth: null,
//     },
//   )

//   const contestant1 = await db.create('contestant')

//   console.dir(
//     await db.query('contestant').include('*', '**').get().toObject(),
//     {
//       depth: null,
//     },
//   )

//   const country1 = await db.create('country', { name: 'xxx' })

//   console.dir(
//     await db.query('contestant').include('*', '**').get().toObject(),
//     {
//       depth: null,
//     },
//   )

//   console.log(
//     '--->',
//     await db
//       .query('contestant', contestant1)
//       .include('*', '**')
//       .get()
//       .toObject(),
//   )

//   await db.update('contestant', contestant1, {
//     name: 'New contestant',
//     country: country1,
//   })

//   console.log(
//     '--->',
//     await db.query('country', country1).include('*', '**').get().toObject(),
//   )

//   console.dir(
//     await db.query('contestant').include('*', '**').get().toObject(),
//     {
//       depth: null,
//     },
//   )

//   console.log(
//     '--->',
//     await db
//       // @ts-ignore
//       .query('contestant', {
//         id: 1,
//         maxVotes: 0,
//         price: 0,
//         name: 'New country',
//         destination: '',
//         votingText: '',
//         votingLegal: '',
//       })
//       .include('*', '**')
//       .get()
//       .toObject(),
//   )
// })

await test('single ref save and load', async (t) => {
  let db = new BasedDb({
    path: t.tmp,
  })

  await db.start()

  const schema = {
    types: {
      user: {
        name: 'string',
        email: { type: 'alias', format: 'email' },
        invitedBy: { ref: 'user', prop: 'invited' },
      },
    },
  } as const

  await db.setSchema(schema)

  const users = [{ email: '1@saulx.com' }, { email: '2@saulx.com' }]

  for (const user of users) {
    await db.upsert('user', user)
  }

  await db.stop()

  db = new BasedDb({
    path: t.tmp,
  })

  await db.start()
  await db.create('user', {
    email: '3@saulx.com',
    invitedBy: 2,
  })

  deepEqual(
    await db.query('user').include('email', 'invitedBy').get().toObject(),
    [
      { id: 1, email: '1@saulx.com', invitedBy: null },
      { id: 2, email: '2@saulx.com', invitedBy: null },
      {
        id: 3,
        email: '3@saulx.com',
        invitedBy: { id: 2, email: '2@saulx.com', name: '' },
      },
    ],
  )

  await db.stop()
})

await test('single2many - update refs', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      product: {
        props: {
          reviews: {
            items: {
              ref: 'review',
              prop: 'product',
            },
          },
        },
      },
      review: {
        props: {
          product: { ref: 'product', prop: 'reviews' },
          rating: { type: 'uint8' },
        },
      },
    },
  })

  const review1 = await db.create('review', {
    rating: 1,
  })

  const product1 = await db.create('product', {
    reviews: [review1],
  })

  const review2 = await db.create('review', {
    rating: 2,
  })

  const product2 = await db.create('product', {
    reviews: [review1, review2],
  })

  const review3 = await db.create('review', {
    rating: 3,
  })

  await db.update('product', product1, {
    reviews: [review1, review2, review3],
  })

  await db.update('product', product2, {
    reviews: [review1, review2, review3],
  })

  const products = await db.query('product').include('*', '**').get().toObject()
  const reviews = await db.query('review').include('*', '**').get().toObject()

  deepEqual(products, [
    { id: 1, reviews: [] },
    {
      id: 2,
      reviews: [
        { id: 1, rating: 1 },
        { id: 2, rating: 2 },
        { id: 3, rating: 3 },
      ],
    },
  ])
  deepEqual(reviews, [
    { id: 1, rating: 1, product: { id: 2 } },
    { id: 2, rating: 2, product: { id: 2 } },
    { id: 3, rating: 3, product: { id: 2 } },
  ])
})

await test('reference to a non-existing node', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  t.after(() => t.backup(db))
  await db.start({ clean: true })

  await db.setSchema({
    types: {
      user: {
        props: {
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

  const mrSnurp = await db.create('user', {
    articles: [1],
  })
  // RFE Is this the correct behavior
  deepEqual(await db.query('user', mrSnurp).include('**').get(), {
    id: 1,
    articles: [],
  })

  const article = await db.create('article')
  deepEqual(article, 1)

  deepEqual(await db.query('user', mrSnurp).include('**').get(), {
    id: 1,
    articles: [],
  })
})
