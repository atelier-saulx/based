import { BasedServer } from '@based/server'
import { createConfigDb, handleSchemaUpdates } from './db.js'
import { setupFunctionHandlers } from './functions.js'
import { BasedDb } from '@based/db'
import { join } from 'path'
import { wait } from '@saulx/utils'

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
    console.log('destroying server')
    await server.destroy()
    console.log('destroying configDb')
    await configDb.destroy()
    console.log('destroying clients')
    for (const name in clients) {
      console.log('destroying client', name)
      await clients[name].destroy()
    }
    for (const name in servers) {
      console.log('destroying server', name)
      await servers[name].destroy()
    }
  }
}

export default start
