import { DbClient, DbServer, BasedDb } from '@based/db'
import { deSerialize } from '@based/schema'
import { wait } from '@based/utils'
import { join } from 'path'

export async function handleSchemaUpdates(configDb: DbClient, path: string) {
  const clients: Record<string, DbClient> = {}
  const servers: Record<string, DbServer> = {}

  await new Promise<void>((resolve) =>
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
            clients[name].destroy()
            delete clients[name]
          }
        }

        for (const name in servers) {
          if (!names.has(name)) {
            await servers[name].destroy().catch((e) => console.error(name, e))
            delete servers[name]
          }
        }
        resolve()
      }),
  )

  return { clients, servers }
}
