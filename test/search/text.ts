import test from '../shared/test.js'
import { testDb } from '../shared/index.js'
import { join } from 'path'

await test('text search', async (t) => {
  const db = await testDb(t, {
    locales: {
      en: {
        /* required: true */
      },
      nl: {},
    },
    types: {
      project: {
        props: {
          createdAt: {
            type: 'timestamp',
            on: 'create',
          },
          title: { type: 'string', localized: true },
          description: { type: 'string', localized: true },
          abstract: { type: 'string' },
        },
      },
    },
  })

  await db.create(
    'project',
    {
      title: 'Het Krakeel',
      abstract:
        'Wij, Jeroen, Sonja, Dionne, Michiel en Ad willen met gelijkgestemde huishoudens een kleinschalig woonproject ontwikkelen en bouwen in een landelijke omgeving waar ruimte is voor een moestuin, fruitbomen, een bijenvolk, kippen, konijnen, wormen- en insectenhotel, ruimte om te spelen en om samen te zijn.',
    },
    { locale: 'en' },
  )

  await db.create(
    'project',
    {
      title: 'Buurzaam',
      abstract:
        'Wij, Jeroen, Sonja, Dionne, Michiel en Ad willen met gelijkgestemde huishoudens een kleinschalig woonproject ontwikkelen en bouwen in een landelijke omgeving waar ruimte is voor een moestuin, fruitbomen, een bijenvolk, kippen, konijnen, wormen- en insectenhotel, ruimte om te spelen en om samen te zijn.',
    },
    { locale: 'en' },
  )

  for (let i = 0; i < 10000; i++) {
    await db.create(
      'project',
      {
        title: 'Minitopia Poeldonk',
        abstract:
          'Tiny Houses Crabbehof is begonnen in 2021 en bestaat uit tien zelfbouwkavels in Dordrecht. De tiny houses mogen hier voor een periode van tien jaar staan en zijn aangesloten op water, elektra en riolering. Verder vind je hier een fietsenstalling, een gemeenschapp',
      },
      { locale: 'en' },
    )
  }

  let searchTerms = ['a', 'ab', 'abc', 'abcd']

  // FIXME add asserts
  for (const term of searchTerms) {
    await db.query('project').search(term, 'title', 'abstract').get()
    // .inspect()
  }

  searchTerms = ['kr', 'kra', 'krak', 'krake', 'krakee']

  for (let i = 0; i < 1000; i++) {
    searchTerms.push('F')
  }

  const q: any[] = []
  for (const term of searchTerms) {
    q.push(
      (async () => {
        await db.query('project').search(term, 'title', 'abstract').get()
        // .inspect()
      })(),
    )
  }
  await Promise.all(q)
})

await test('search', async (t) => {
  const db = await testDb(t, {
    locales: {
      en: {},
      fi: { fallback: ['en'] },
    },
    types: {
      dialog: {
        props: {
          fun: {
            type: 'string',
            localized: true,
          },
        },
      },
    },
  })

  await db.create('dialog', {
    fun: { en: 'hello its the united kingdom', fi: 'hello its finland' },
  })

  await db.create('dialog', {
    fun: { en: 'its mr derp!', fi: 'its mr snurp!' },
  })

  await db.drain()

  deepEqual(
    await db
      .query('dialog')
      .include('id', 'fun')
      .search('finland', 'fun')
      .get(),
    [
      {
        id: 1,
        fun: {
          en: 'hello its the united kingdom',
          fi: 'hello its finland',
        },
        $searchScore: 0,
      },
    ],
    'Search for finland',
  )

  deepEqual(
    await db
      .query('dialog')
      .include('id', 'fun')
      .search('kingdom', 'fun')
      .get(),
    [
      {
        id: 1,
        fun: {
          en: 'hello its the united kingdom',
          fi: 'hello its finland',
        },
        $searchScore: 0,
      },
    ],
    'Search for kingdom',
  )

  deepEqual(
    await db.query('dialog').include('id', 'fun').search('snurp', 'fun').get(),
    [
      {
        id: 2,
        fun: {
          en: 'its mr derp!',
          fi: 'its mr snurp!',
        },
        $searchScore: 0,
      },
    ],
    'Search for snurp',
  )

  deepEqual(
    await db.query('dialog').include('id', 'fun').search('derp', 'fun').get(),
    [
      {
        id: 2,
        fun: {
          en: 'its mr derp!',
          fi: 'its mr snurp!',
        },
        $searchScore: 0,
      },
    ],
    'Search for derp',
  )

  deepEqual(
    await db
      .query('dialog')
      .locale('fi')
      .include('id', 'fun')
      .search('derp', 'fun')
      .get(),
    [],
    'Search for derp with locale set to fi',
  )

  deepEqual(
    await db
      .query('dialog')
      .locale('en')
      .include('id', 'fun')
      .search('derp', 'fun')
      .get(),
    [
      {
        id: 2,
        fun: 'its mr derp!',
        $searchScore: 0,
      },
    ],
    'Search for derp with locale set to en',
  )

  deepEqual(
    await db
      .query('dialog')
      .include('id', 'fun')
      .search('derp', 'fun.en')
      .get(),
    [
      {
        id: 2,
        fun: {
          en: 'its mr derp!',
          fi: 'its mr snurp!',
        },
        $searchScore: 0,
      },
    ],
    'Search for derp in fun.en',
  )
})

await test('reference text', async (t) => {
  const db = await testDb(t, {
    locales: {
      en: { required: true },
      fr: { required: true },
    },
    types: {
      country: {
        name: 'string',
        votingLegal: {
          type: 'string',
          localized: true,
        },
      },
      contestant: {
        name: 'string',
        country: { ref: 'country', prop: 'contestants' },
      },
    },
  })

  const country1 = await db.create('country', {})

  await db.create('contestant', {
    name: 'New contestant',
    country: country1,
  })

  deepEqual(await db.query('country').include('*').get(), [
    {
      id: 1,
      name: '',
      votingLegal: {
        en: '',
        fr: '',
      },
    },
  ])

  deepEqual(await db.query('contestant').include('*', 'country').get(), [
    {
      id: 1,
      name: 'New contestant',
      country: {
        id: 1,
        name: '',
        votingLegal: {
          en: '',
          fr: '',
        },
      },
    },
  ])
})
