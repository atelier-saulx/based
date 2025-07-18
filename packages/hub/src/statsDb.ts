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
        checksum: 'uint32',
        totalErrors: 'uint32',
        logs: {
          items: {
            ref: 'log',
            prop: 'function',
            dependent: true,
          },
        },
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
