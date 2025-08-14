import { BasedDb } from '@based/db'
import { join } from 'path'

const createdAt = { type: 'timestamp', on: 'create' } as const
const updatedAt = { type: 'timestamp', on: 'update' } as const

export const createConfigDb = async (basePath: string) => {
  const configDb = new BasedDb({
    maxModifySize: 5 * 1e3 * 1e3,
    path: join(basePath, 'config'),
  })
  await configDb.start()
  await configDb.setSchema({
    types: {
      schema: {
        name: 'alias',
        schema: 'binary',
        status: ['pending', 'error', 'ready'],
        createdAt,
        updatedAt,
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
        createdAt,
        updatedAt,
        checksum: 'uint32',
        loaded: 'uint32',
      },
      secret: {
        name: 'alias',
        value: 'string',
        // by whom?
        createdAt,
        updatedAt,
      },
    },
  })
  return configDb
}
