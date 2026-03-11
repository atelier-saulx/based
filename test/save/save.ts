import { DbClient, DbServer, getDefaultHooks } from '../../src/sdk.js'
import { deepEqual, equal } from '../shared/assert.js'
import { testDbClient } from '../shared/index.js'
import test from '../shared/test.js'

await test('simple', async (t) => {
  const db = new DbServer({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  const schema = {
    locales: {
      en: {},
      fr: {},
      nl: {},
      el: {},
      he: {},
      it: {},
      lv: {},
      lb: {},
      ro: {},
      sl: {},
      es: {},
      de: {},
      cs: {},
      et: {},
    },
    types: {
      user: {
        props: {
          name: { type: 'string' },
          email: { type: 'string' },
          age: { type: 'uint32' },
          story: { type: 'string' },
          test: { ref: 'typeTest', prop: 'q' },
          alias: { type: 'alias' },
        },
      },
      typeTest: {
        props: {
          a: { type: 'string' },
          b: { type: 'number' },
          c: { type: 'boolean' },
          //d: { type: 'object' },
          e: { type: 'timestamp' },
          f: { type: 'binary' },
          g: { type: 'alias' },
          h: { type: 'string', localized: true },
          i: { type: 'json' },
          j: { type: 'cardinality' },
          k: { type: 'int8' },
          l: { type: 'int16' },
          m: { type: 'uint16' },
          n: { type: 'int32' },
          o: { type: 'uint32' },
          //p: { type: 'references', ref: 'typeTest', prop: 'reference' },
          q: { type: 'reference', ref: 'user', prop: 'test' },
          r: { type: 'enum', enum: ['a', 'b', 'c'] },
          s: { type: 'vector', size: 1, baseType: 'float32' },
          //t: { type: 'set' },
        },
      },
    },
  } as const
  const client = await testDbClient(db, schema)

  client.create('user', {
    name: 'youzi',
    email: 'youzi@yazi.yo',
    alias: 'best',
  })
  client.create('user', {
    name: 'youri',
    email: 'youri@yari.yo',
    alias: 'alsobest',
  })
  client.create('typeTest', {})

  await client.drain()
  await db.save()

  const db2 = new DbServer({
    path: t.tmp,
  })
  await db2.start()
  t.after(() => db2.destroy())
  const client2 = new DbClient<typeof schema>({
    hooks: getDefaultHooks(db2),
  })

  const a = await client.query('user').get()
  const b = await client2.query('user').get()
  deepEqual(b, a)

  const c = await client.create('user', { name: 'jerp' })
  const d = await client2.create('user', { name: 'jerp' })
  equal(c, 3)
  equal(d, 3)

  await db2.save()

  await client2.create('user', { name: 'jerp' })
  await db2.save()

  await client2.create('user', { name: 'jerp' })
  await db2.save()
})

await test('refs', async (t) => {
  const schema = {
    types: {
      group: {
        props: {
          name: { type: 'string' },
          users: {
            items: {
              ref: 'user',
              prop: 'group',
            },
          },
        },
      },
      user: {
        props: {
          name: { type: 'string' },
          email: { type: 'string' },
          group: {
            ref: 'group',
            prop: 'users',
          },
        },
      },
    },
  } as const

  const db = new DbServer({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  const client = await testDbClient(db, schema)

  const grp = client.create('group', {
    name: 'best',
  })
  client.create('user', {
    name: 'youzi',
    email: 'youzi@yazi.yo',
    group: grp,
  })

  client.create('user', {
    name: 'youri',
    email: 'youri@yari.yo',
    group: grp,
  })

  await client.drain()
  await db.save()

  const db2 = new DbServer({
    path: t.tmp,
  })
  t.after(() => db2.destroy())
  await db2.start()
  const client2 = new DbClient<typeof schema>({
    hooks: getDefaultHooks(db2),
  })

  const users1 = await client.query('user').include('group').get()
  const users2 = await client2.query('user').include('group').get()

  deepEqual(users1, users2)
})

await test('text', async (t) => {
  const schema = {
    locales: {
      en: true,
      nl: { fallback: ['en'] },
      fi: { fallback: ['en', 'nl'] },
    },
    types: {
      article: {
        props: {
          title: { type: 'string', localized: true },
          body: { type: 'string', localized: true },
        },
      },
    },
  } as const
  const db = new DbServer({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  const client = await testDbClient(db, schema)

  // Text: Wikipedia CC BY-SA 4.0
  client.create('article', {
    title: {
      en: 'Galileo Galilei',
      fi: 'Galileo Galilei',
    },
    body: {
      en: "Galileo di Vincenzo Bonaiuti de' Galilei (15 February 1564 – 8 January 1642), commonly referred to as Galileo Galilei (/ˌɡælɪˈleɪoʊ ˌɡælɪˈleɪ/, US also /ˌɡælɪˈliːoʊ -/; Italian: [ɡaliˈlɛːo ɡaliˈlɛːi]) or mononymously as Galileo, was an Italian astronomer, physicist and engineer, sometimes described as a polymath. He was born in the city of Pisa, then part of the Duchy of Florence. Galileo has been called the father of observational astronomy, modern-era classical physics, the scientific method, and modern science.",
      fi: 'Galileo Galilei (15. helmikuuta 1564 Pisa, Firenzen herttuakunta – 8. tammikuuta 1642 Arcetri, Toscanan suurherttuakunta) oli italialainen tähtitieteilijä, filosofi ja fyysikko. Hänen merkittävimmät saavutuksensa liittyvät tieteellisen menetelmän kehitykseen aristoteelisesta nykyiseen muotoonsa. Häntä on kutsuttu tieteen, klassisen fysiikan ja tähtitieteen isäksi.',
    },
  })
  client.create('article', {
    title: {
      en: 'Pope Urban VIII',
      fi: 'Urbanus VIII',
    },
    body: {
      en: 'Pope Urban VIII (Latin: Urbanus VIII; Italian: Urbano VIII; baptised 5 April 1568 – 29 July 1644), born Maffeo Vincenzo Barberini, was head of the Catholic Church and ruler of the Papal States from 6 August 1623 to his death, in July 1644.\nHe was also an opponent of Copernicanism and was involved in the Galileo affair, which saw the astronomer tried for heresy.',
      fi: 'Paavi Urbanus VIII, syntymänimeltään Maffeo Barberini, (huhtikuu 1568 – 29. heinäkuuta 1644) oli paavina 6. elokuuta 1623 – 29. heinäkuuta 1644.\nUrbanus VIII:n paaviuden aikana Galileo Galilei kutsuttiin vuonna 1633 Roomaan vastamaan syytöksiin harhaoppisuudesta',
    },
  })

  await client.drain()
  await db.save()

  const db2 = new DbServer({
    path: t.tmp,
  })
  t.after(() => db2.destroy())
  await db2.start()
  const client2 = new DbClient<typeof schema>({
    hooks: getDefaultHooks(db2),
  })

  const articles1 = await client.query('article').get()
  const articles2 = await client2.query('article').get()
  deepEqual(articles1, articles2)
})

await test('upsert', async (t) => {
  const db = new DbServer({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  const schema = {
    types: {
      person: {
        props: {
          name: { type: 'string', max: 8 },
          age: { type: 'uint8' },
          alias: { type: 'alias' },
        },
      },
    },
  } as const
  const client = await testDbClient(db, schema)

  client.create('person', {
    name: 'Joe',
    alias: 'boss',
  })
  await client.drain()
  await db.save()
  await client.upsert('person', { alias: 'boss' }, { age: 42 })
  await client.drain()
  await db.save()

  // load the same db into a new instance
  const db2 = new DbServer({
    path: t.tmp,
  })
  await db2.start()
  t.after(() => db2.destroy())
  const client2 = new DbClient<typeof schema>({
    hooks: getDefaultHooks(db2),
  })

  deepEqual(await client.query('person').get(), [
    { id: 1, name: 'Joe', age: 42, alias: 'boss' },
  ])
  deepEqual(await client2.query('person').get(), [
    { id: 1, name: 'Joe', age: 42, alias: 'boss' },
  ])
})

await test('alias blocks', async (t) => {
  const db = new DbServer({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  const schema = {
    types: {
      person: {
        props: {
          name: { type: 'string', max: 8 },
          alias: { type: 'alias' },
        },
      },
    },
  } as const
  const client = await testDbClient(db, schema)

  for (let i = 0; i < 100_000; i++) {
    client.create('person', {
      name: 'Joe',
    })
  }
  await client.drain()
  await db.save()
  const john = await client.create('person', {
    name: 'John',
    alias: 'bf',
  })
  await client.drain()
  await db.save()
  client.update('person', 1, { alias: 'bf' })
  for (let id = 2; id < john; id++) {
    client.delete('person', id)
  }
  await client.drain()
  await db.save()

  // load the same db into a new instance
  const db2 = new DbServer({
    path: t.tmp,
  })
  await db2.start()
  t.after(() => db2.destroy())
  const client2 = new DbClient<typeof schema>({
    hooks: getDefaultHooks(db2),
  })

  deepEqual(
    await client2.query('person').get(),
    await client.query('person').get(),
  )
})

await test('simulated periodic save', async (t) => {
  const db = new DbServer({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.destroy())

  const schema = {
    types: {
      book: {
        props: {
          name: { type: 'string', max: 16 },
          isbn: { type: 'string', max: 13 },
          owner: { ref: 'person', prop: 'books' },
        },
      },
      person: {
        props: {
          name: { type: 'string', max: 16 },
          age: { type: 'uint32' },
          bf: { ref: 'person', prop: 'bf' },
          books: { items: { ref: 'book', prop: 'owner' } },
          alias: { type: 'alias' },
        },
      },
    },
  } as const
  const client = await testDbClient(db, schema)

  // create some people
  const people = await Promise.all([
    client.create('person', {
      name: 'Slim',
      alias: 'slim',
    }),
    client.create('person', {
      name: 'Slick',
      alias: 'slick',
    }),
    client.create('person', {
      name: 'Joe',
      alias: 'joe',
    }),
    client.create('person', {
      name: 'Ben',
      alias: 'boss',
    }),
    client.create('person', {
      name: 'Steve',
    }),
  ])

  client.update('person', people[1], {
    bf: people[2],
  })

  // create some books
  for (let i = 0; i < 1000; i++) {
    client.create('book', {
      name: `book ${i}`,
      isbn: '9789295055025',
      owner: people[i % people.length],
    })
  }
  await client.drain()
  await db.save()

  // more books
  for (let i = 0; i < 1000; i++) {
    client.create('book', {
      name: `book ${1000 + i}`,
      isbn: '9789295055025',
      owner: people[i % people.length],
    })
  }
  await client.drain()
  await db.save()

  // change a node using an alias
  client.upsert('person', { alias: 'slim' }, { name: 'Shady' })
  await client.drain()

  await db.save()

  // replace alias
  client.create('person', {
    name: 'Slide',
    alias: 'slick',
  })
  await client.drain()
  await db.save()

  // move alias
  await client.update('person', people[4], {
    alias: 'boss',
  })

  await client.drain()
  await db.save()

  // load the same db into a new instance
  const db2 = new DbServer({
    path: t.tmp,
  })
  await db2.start()
  t.after(() => db2.destroy())
  const client2 = new DbClient<typeof schema>({
    hooks: getDefaultHooks(db2),
  })

  // Change node using alias saved
  deepEqual(
    await client
      .query('person')
      .filter('alias', 'includes', 'slim')
      .include('alias', 'name')
      .get(),
    [{ id: 1, alias: 'slim', name: 'Shady' }],
  )
  deepEqual(
    await client2
      .query('person')
      .filter('alias', 'includes', 'slim')
      .include('alias', 'name')
      .get(),
    [{ id: 1, alias: 'slim', name: 'Shady' }],
  )

  // Replace alias saved
  deepEqual(
    await client
      .query('person')
      .filter('alias', 'includes', 'slick')
      .include('alias', 'name')
      .get(),
    [{ id: 6, alias: 'slick', name: 'Slide' }],
  )
  deepEqual(
    await client2
      .query('person')
      .filter('alias', 'includes', 'slick')
      .include('alias', 'name')
      .get(),
    [{ id: 6, alias: 'slick', name: 'Slide' }],
  )

  // Move alias saved
  deepEqual(
    await client
      .query('person')
      .filter('alias', 'includes', 'boss')
      .include('alias', 'name')
      .get(),
    [{ id: 5, name: 'Steve', alias: 'boss' }],
  )
  deepEqual(
    await client2
      .query('person')
      .filter('alias', 'includes', 'boss')
      .include('alias', 'name')
      .get(),
    [{ id: 5, name: 'Steve', alias: 'boss' }],
  )

  // All have the same books
  deepEqual(
    await client2.query('person').include('name', 'alias', 'books').get(),
    await client.query('person').include('name', 'alias', 'books').get(),
  )
})

await test('edge val', async (t) => {
  const db = new DbServer({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  const client = await testDbClient(db, {
    types: {
      round: {
        name: 'alias',
      },
      sequence: {
        name: 'alias',
      },
      scenario: {
        name: 'alias',
      },
      phase: {
        name: 'alias',
        round: {
          ref: 'round',
          prop: 'phases',
        },
        scenarios: {
          items: {
            ref: 'scenario',
            prop: 'phases',
            $sequence: {
              ref: 'sequence',
            },
          },
        },
      },
    },
  })

  const sequence1 = await client.create('sequence', {})
  const sequence2 = await client.create('sequence', {})
  const scenario1 = await client.create('scenario', {})
  const scenario2 = await client.create('scenario', {})
  const phase = await client.create('phase', {
    scenarios: [
      {
        id: scenario1,
        $sequence: sequence1,
      },
    ],
  })
  await db.save()
  client.update('phase', phase, {
    scenarios: {
      add: [
        {
          id: scenario2,
          $sequence: sequence2,
        },
      ],
    },
  })
  //await client.query('phase').include('scenarios.$sequence').get().inspect()
  await db.save()

  await client.update('phase', phase, {
    scenarios: {
      delete: [scenario1],
    },
  })
  //await client.query('phase').include('scenarios.$sequence').get().inspect()
})

await test('no mismatch', async (t) => {
  const db = new DbServer({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => db.stop(true))

  const schema = {
    types: {
      user: {
        props: {
          name: { type: 'string' },
        },
      },
    },
  } as const
  const client = await testDbClient(db, schema)

  await client.create('user', {
    name: 'xxx',
  })

  await db.save()

  const db2 = new DbServer({
    path: t.tmp,
  })
  t.after(() => t.backup(db2))
  await db2.start()

  const client2 = new DbClient<typeof schema>({
    hooks: getDefaultHooks(db2),
  })

  await client2.create('user', {
    name: 'xxx',
  })
  await client2.create('user', {
    name: 'xxx2',
  })

  await db2.save()
})
