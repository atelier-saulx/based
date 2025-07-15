import { BasedServer } from '@based/server'
import { createConfigDb, handleSchemaUpdates } from './db'
import { setupFunctionHandlers } from './functions'
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

  clients.default = defaultDb.client
  servers.default = defaultDb.server
  server.client.db = defaultDb.client

  await defaultDb.start()
  await server.start()

  return async () => {
    console.log('destroying')
    await server.destroy()
    await configDb.destroy()
    for (const name in clients) {
      await clients[name].destroy()
    }
    for (const name in servers) {
      await servers[name].destroy()
    }
    console.log('destroying - done')
  }
}

export default start
