import { deepMerge, wait } from '@based/utils'
import { DbClient } from '../../src/client/index.js'
import { BasedDb, getDefaultHooks } from '../../src/index.js'
import { DbServer } from '../../src/server/index.js'
import test from '../shared/test.js'
import { deepEqual, equal } from '../shared/assert.js'
import type { SchemaType } from '@based/schema'

const start = async (t, clientsN = 2) => {
  const server = new DbServer({
    path: t.tmp,
  })

  const clients = Array.from({ length: clientsN }).map(
    () =>
      new DbClient({
        hooks: getDefaultHooks(server, 10),
      }),
  )

  await server.start({ clean: true })
  t.after(() => server.destroy())
  return { clients, server }
}

await test('subscription schema changes', async (t) => {
  const clientsN = 2
  const { clients } = await start(t, clientsN)

  await clients[0].setSchema({
    types: {
      user: {
        derp: 'uint8',
        location: 'string',
        lang: 'string',
        friends: {
          items: {
            ref: 'user',
            prop: 'friends',
          },
        },
      },
    },
  })

  await clients[0].create('user', {
    derp: 20,
    lang: 'de',
  })
  let cnt = 0
  const q = clients[1]
    .query('user')
    .include('derp', 'lang')
    .include((s) => {
      s('friends').include('*')
    })
    .filter('lang', '=', 'de')
  const result1 = q.get().toObject()
  await clients[0].setSchema({
    types: {
      user: {
        flap: 'uint16',
        derp: 'uint8',
        location: 'string',
        lang: { type: 'string', maxBytes: 2 },
        friends: {
          items: {
            ref: 'user',
            prop: 'friends',
          },
        },
      },
    },
  })
  await wait(20)
  q.reset()
  deepEqual(result1, q.get(), 'first schema change results are correct')
  const subResults = []
  const close = q.subscribe(async (q) => {
    subResults.push(await q.toObject())
    cnt++
  })
  t.after(() => {
    close()
  })
  await wait(20)
  await clients[0].setSchema({
    types: {
      user: {
        flap: 'uint16',
        derp: 'uint8',
        location: 'string',
        lang: { type: 'string', maxBytes: 4 },
        friends: {
          items: {
            ref: 'user',
            prop: 'friends',
          },
        },
      },
    },
  })
  await clients[0].update('user', 1, {
    derp: 100,
  })
  await wait(1000)

  equal(cnt, 3, 'fired 3 times')
  deepEqual(
    subResults,
    [
      [{ id: 1, derp: 20, lang: 'de', friends: [] }],
      [{ id: 1, derp: 20, lang: 'de', friends: [] }],
      [{ id: 1, derp: 100, lang: 'de', friends: [] }],
    ],
    'sub results correct',
  )
})

await test('better subscription schema changes', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => db.destroy())

  await db.setSchema({
    types: {
      user: {
        name: 'string',
      },
    },
  })

  const results = []
  db.query('user').subscribe((res) => {
    const obj = res.toObject()
    results.push(obj)
  })

  await wait(300)

  await db.create('user', {
    name: 'youzi',
  })

  await wait(300)

  await db.setSchema({
    types: {
      user: {
        name: 'string',
        nice: 'boolean',
      },
    },
  })

  await wait(300)

  await db.create('user', {
    name: 'jamex',
  })

  await wait(300)

  await db.setSchema({
    types: {
      user: {
        nice: 'boolean',
      },
    },
  })

  await wait(300)

  deepEqual(results, [
    [],
    [{ id: 1, name: 'youzi' }],
    [{ id: 1, nice: false, name: 'youzi' }],
    [
      { id: 1, nice: false, name: 'youzi' },
      { id: 2, nice: false, name: 'jamex' },
    ],
    [
      { id: 1, nice: false },
      { id: 2, nice: false },
    ],
  ])
})

await test('schema-change-2', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })

  await db.start({ clean: true })

  t.after(() => db.destroy())

  const currencies = [
    'eur',
    'all',
    'amd',
    'aud',
    'azn',
    'chf',
    'czk',
    'dkk',
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
  ]

  const edition: SchemaType = {
    name: { type: 'alias' },
    winner: 'string',
    htmlConfig: {
      type: 'object',
      props: {
        title: 'text',
        description: 'text',
        // image: { ref: 'file', prop: 'imageOfConfig' },
        // favicon: { ref: 'file', prop: 'faviconOfConfig' },
      },
    },
    theme: {
      type: 'object',
      props: {
        primaryAccent: 'string',
        secondaryAccent: 'string',
        outline: 'string',
        border: 'string',
        textPrimary: 'string',
        textSecondary: 'string',
        textTertiary: 'string',
        error: 'string',
      },
    },
    dictionary: {
      type: 'object',
      props: {
        // WIP, update based on app design

        // UI
        title: 'text',
        homeButton: 'text',
        votingRulesButton: 'text',
        termsButton: 'text',
        privacyButton: 'text',
        imprintButton: 'text',

        // Pages:
        terms: 'text',
        privacy: 'text',
        rules: 'text',
        imprint: 'text',
      },
    },
    config: {
      type: 'object',
      props: {
        price: 'uint16',
        currency: currencies,
        blacklistedCountries: 'json',
        maxVotes: 'uint8',
      },
    },
    // sequences: {
    //   items: {
    //     ref: 'sequence',
    //     prop: 'edition',
    //   },
    // },
    // contestants: {
    //   items: {
    //     ref: 'contestant',
    //     prop: 'edition',
    //   },
    // },
    // rounds: {
    //   items: {
    //     ref: 'round',
    //     prop: 'edition',
    //   },
    // },
    published: 'json',
    currentLiveSequence: 'json',
  } as const satisfies SchemaType

  await db.setSchema({
    locales: { en: true },
    types: {
      edition,
    },
  })

  const id = await db.create('edition', {
    name: 'party-time',
  })

  let resolve: any
  const nextPromise = () => new Promise((r) => (resolve = r))
  const res1 = nextPromise()
  db.query('edition', id).subscribe((res) => {
    console.log('res:', res.toObject().name)
    resolve(res.toObject())
  })

  console.log(await res1)
  const newEditionSchema = deepMerge({}, edition, {
    published: 'number',
  })

  delete newEditionSchema.winner
  await db.setSchema({
    locales: {
      en: true,
    },
    types: {
      edition: newEditionSchema,
    },
  })

  const res2 = nextPromise()

  await db.update('edition', id, {
    name: 'burpy',
  })
  console.log('----')
  console.log(await res2)
})
