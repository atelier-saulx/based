import { BasedDb } from '@based/db'
import { join } from 'path'

export const createConfigDb = async (basePath: string) => {
  const configDb = new BasedDb({
    maxModifySize: 1e3 * 1e3,
    path: join(basePath, 'config'),
  })
  await configDb.start()
  await configDb.setSchema({
    types: {
      schema: {
        name: 'alias',
        schema: 'binary',
        status: ['ready', 'error', 'pending'],
        createdAt: { type: 'timestamp', on: 'create' },
        updatedAt: { type: 'timestamp', on: 'update' },
      },
      function: {
        name: 'alias',
        type: [
          'authorize',
          'app',
          'function',
          'job',
          'query',
          'stream',
          'channel',
        ],
        code: 'string',
        config: 'json',
        createdAt: { type: 'timestamp', on: 'create' },
        updatedAt: { type: 'timestamp', on: 'update' },
      },
      secret: {
        name: 'alias',
        value: 'string',
        createdAt: { type: 'timestamp', on: 'create' },
        updatedAt: { type: 'timestamp', on: 'update' },
      },
    },
  })
  return configDb
}
