import test from '../shared/test.js'
import { testDb } from '../shared/index.js'
import { deepEqual } from '../shared/assert.js'

await test('compressionFilter', async (t) => {
  const db = await testDb(t, {
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
