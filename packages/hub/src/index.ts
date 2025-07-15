import { BasedServer } from '@based/server'
import { createConfigDb, handleSchemaUpdates } from './db.js'
import { setupFunctionHandlers } from './functions.js'
import { BasedDb } from '@based/db'
import { join } from 'path'

type Opts = {
  port: number
  path: string
}

const start = async ({ port, path }: Opts) => {
  const configDb = await createConfigDb(path)
  const server = new BasedServer({ port })

  setupFunctionHandlers(server, configDb.client)

  const { clients, servers } = handleSchemaUpdates(configDb.client, path)
  const defaultDb = new BasedDb({
    path: join(path, 'default'),
  })

  await defaultDb.start()
  await server.start()

  clients.default = defaultDb.client
  servers.default = defaultDb.server
  server.client.db = defaultDb.client

  return async () => {
    await server.destroy()
    await configDb.destroy()
    for (const name in clients) {
      await clients[name].destroy()
    }
    for (const name in servers) {
      await servers[name].destroy()
    }
  }
}

export default start
