import { BasedDb, DbClient, DbServer } from '@based/db'
import { deSerialize } from '@based/schema'
import { wait } from '@saulx/utils'
import { join } from 'path'

export async function createConfigDb(path: string) {
  const configDb = new BasedDb({
    path: join(path, 'config'),
  })
  await configDb.start()
  await configDb.setSchema({
    types: {
      schema: {
        name: 'alias',
        schema: 'binary',
        status: ['ready', 'error', 'pending'],
        createdAt: {
          type: 'timestamp',
          on: 'create',
        },
        updatedAt: {
          type: 'timestamp',
          on: 'update',
        },
      },
      function: {
        name: 'alias',
        type: ['authorize', 'app', 'function', 'job', 'query', 'stream'],
        contents: 'string',
        config: 'json',
        createdAt: {
          type: 'timestamp',
          on: 'create',
        },
        updatedAt: {
          type: 'timestamp',
          on: 'update',
        },
      },
    },
  })
  return configDb
}

export function handleSchemaUpdates(configDb: DbClient, path: string) {
  const clients: Record<string, DbClient> = {}
  const servers: Record<string, DbServer> = {}

  configDb
    .query('schema')
    .include('name', 'schema')
    .subscribe(async (data) => {
      const names = new Set(['default'])
      await Promise.allSettled(
        data.map(async ({ id, name, schema }) => {
          names.add(name)

          if (!clients[name]) {
            const db = new BasedDb({
              path: join(path, name),
            })
            clients[name] = db.client
            servers[name] = db.server
            await db.start()
          }

          try {
            await clients[name].setSchema(deSerialize(schema))
            // TODO why do we need this?
            await wait(100)
            await configDb.update('schema', id, { status: 'ready' })
          } catch (e) {
            await configDb.update('schema', id, { status: 'error' })
          }
        }),
      )

      for (const name in clients) {
        if (!names.has(name)) {
          await clients[name].destroy()
          delete clients[name]
        }
      }

      for (const name in servers) {
        if (!names.has(name)) {
          await servers[name].destroy().catch((e) => console.error(name, e))
          delete servers[name]
        }
      }
    })

  return { clients, servers }
}
