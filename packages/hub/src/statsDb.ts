import { BasedDb } from '@based/db'
import { join } from 'path'

export const createStatsDb = async (basePath: string) => {
  const configDb = new BasedDb({
    maxModifySize: 1e3 * 1e3,
    path: join(basePath, 'stats'),
  })
  await configDb.start()
  await configDb.setSchema({
    types: {
      function: {
        name: 'alias',
        uniqueVisitors: 'cardinality',
        totalRequests: 'uint32',
        totalErrors: 'uint32',
        checksum: 'uint32',
        connections: 'uint32',
        logs: {
          items: {
            ref: 'log',
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
      log: {
        msg: { type: 'string', compression: 'none' },
        function: {
          ref: 'function',
          prop: 'logs',
        },
        createdAt: { type: 'timestamp', on: 'create' },
        type: ['info', 'error', 'warn', 'debug', 'log', 'trace'],
      },
      // meausement (avarage measurement)
    },
  })
  return configDb
}
