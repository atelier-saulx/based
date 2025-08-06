import { BasedDb } from '@based/db'
import { join } from 'path'

export const createStatsDb = async (basePath: string) => {
  const statsDb = new BasedDb({
    maxModifySize: 1e3 * 1e3,
    path: join(basePath, 'stats'),
  })
  await statsDb.start()
  await statsDb.setSchema({
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
        msg: 'string',
        function: {
          ref: 'function',
          prop: 'events',
        },
        createdAt: { type: 'timestamp', on: 'create' },
        meta: 'string',
        type: ['init', 'deploy', 'runtime', 'security'],
        level: ['info', 'error', 'warn', 'debug'],
      },
    },
  })
  return statsDb
}
