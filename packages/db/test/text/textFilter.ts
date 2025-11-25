import { BasedDb } from '../../src/db.js'
import test from '../shared/test.js'
import { join } from 'path'
import { deepEqual } from '../shared/assert.js'

await test('textFilter', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 1e3 * 1e3,
  })
  await db.start({ clean: true })

  const dbX = new BasedDb({
    path: join(t.tmp, 'x'),
    maxModifySize: 1e3 * 1e3,
  })
  await dbX.start({ clean: true })

  t.after(() => t.backup(db))
  t.after(() => dbX.destroy())

  await db.setSchema({
    locales: {
      en: { required: true },
      nl: {},
    },
    types: {
      project: {
        props: {
          createdAt: {
            type: 'timestamp',
            on: 'create',
          },
          title: { type: 'text' },
          description: { type: 'text' },
          abstract: { type: 'string' },
        },
      },
    },
  })

  await dbX.setSchema({
    locales: {
      en: { required: true },
      nl: {},
    },
    types: {
      project: {
        props: {
          createdAt: {
            type: 'timestamp',
            on: 'create',
          },
          title: { type: 'text' },
          description: { type: 'text' },
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

await test('compressionFilter', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 1e3 * 1e3,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      function: {
        name: 'alias',
        uniqueVisitors: 'cardinality',
        totalRequests: 'uint32',
        totalErrors: 'uint32',
        checksum: 'uint32',
        connections: 'uint32',
        errorOnInitialization: 'boolean',

        // temp
        execTime: 'uint32',

        events: {
          items: {
            ref: 'event',
            prop: 'function',
            dependent: true,
          },
        },
        measurements: {
          props: {
            current: {
              ref: 'measurement',
              prop: 'current',
              dependent: true,
            },
            history: {
              items: {
                ref: 'measurement',
                prop: 'function',
                dependent: true,
              },
            },
          },
        },
      },
      measurement: {
        execTime: 'uint32',
        calls: 'uint32',
        errors: 'uint32',
        uniqueVisitors: 'cardinality',
        maxConcurrentConnections: 'uint32',
        current: {
          ref: 'function',
          prop: 'measurements.current',
        },
        function: {
          ref: 'function',
          prop: 'measurements.history',
        },
        createdAt: { type: 'timestamp', on: 'create' },
        lastUpdated: { type: 'timestamp', on: 'update' },
      },
      event: {
        msg: { type: 'string' },
        function: {
          ref: 'function',
          prop: 'events',
        },
        createdAt: { type: 'timestamp', on: 'create' },
        meta: {
          type: 'string',
        },
        type: ['init', 'deploy', 'runtime', 'security'],
        level: ['info', 'error', 'warn', 'debug'],
      },
    },
  })

  const derp = `Lorem ipsum dol89258, consectetur adipisci, nisi nisl aliquam enim, eget facilisis enim nisl nec elit. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Suspendisse potenti. Etiam euismod, urna eu tincidunt consectetur, nisi nisl aliquam enim, eget facilisis enim nisl nec elit. Pellentesque habitant mor bi.`

  await db.create('event', {
    msg: derp,
  })

  deepEqual(await db.query('event').filter('msg', 'includes', 'derp').get(), [])
})
