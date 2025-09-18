import { deepEqual } from './shared/assert.js'
import test from './shared/test.js'
import { start } from './shared/multi.js'
import { BasedDb } from '../src/index.js'

await test('upsert', async (t) => {
  const {
    clients: [client1, client2],
  } = await start(t)
  await client1.setSchema({
    types: {
      user: {
        props: {
          name: 'string',
          email: 'alias',
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
          externalId: 'alias',
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

  const youzi = await client1.create('user', {
    name: 'youzi',
    email: 'youzi@flapmail.com',
  })

  const jamez = await client1.create('user', {
    name: 'jamez',
    email: 'james@flapmail.com',
  })

  console.log(await client1.drain(), 'drain server ms')

  for (let i = 0; i < 10000; i++) {
    client1.create('user', {
      name: 'Mr ' + i,
      email: `$mr-{i}@flapmail.com`,
    })
  }

  await client2.upsert('article', {
    externalId: 'flap',
    name: 'flap',
    contributors: [
      client2.upsert('user', {
        email: 'james@flapmail.com',
        name: 'James!',
      }),
      client2.upsert('user', {
        email: 'derp@flapmail.com',
        name: 'Derp!',
      }),
    ],
  })

  deepEqual(await client1.query('article').include('*', '**').get(), [
    {
      id: 1,
      externalId: 'flap',
      name: 'flap',
      contributors: [
        { id: 2, name: 'James!', email: 'james@flapmail.com' },
        { id: 10003, name: 'Derp!', email: 'derp@flapmail.com' },
      ],
    },
  ])
})

await test('upsert no alias', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start()
  // t.after(() => db.destroy())
  t.after(() => db.stop())

  await db.setSchema({
    types: {
      lala: {
        props: {
          lele: 'string',
          lili: 'number',
        },
      },
    },
  })

  // await db.drain()

  await db.query('lala').include('*').get().inspect()

  await db.upsert('lala', {
    lele: 'lulu',
    lili: 813,
  })

  await db.query('lala').include('*').get().inspect()

  await db.upsert('lala', {
    lele: 'lulu',
    lili: 813,
  })

  // await db.query('lala').include('*').get().inspect()
})
