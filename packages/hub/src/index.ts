import { BasedServer } from '@based/server'
import { createConfigDb } from './configDb.js'
import { handleSchemaUpdates } from './schemaManager.js'
import { BasedDb } from '@based/db'
import { join } from 'path'
import { initDynamicFunctions } from './initDynamicFunctions.js'
import { registerApiHandlers } from './registerApiHandlers.js'

type Opts = {
  port: number
  path: string
}

const start = async ({ port, path }: Opts) => {
  const configDb = await createConfigDb(path)
  const server = new BasedServer({ port })

  // Initialize dynamic functions and API handlers
  initDynamicFunctions(server, configDb.client)
  registerApiHandlers(server, configDb.client)

  // Handle schema updates and prepare client/server maps
  const { clients, servers } = handleSchemaUpdates(configDb.client, path)

  // Set up the default database
  const defaultDb = new BasedDb({ path: join(path, 'default') })
  await defaultDb.start()
  await server.start()

  // Register default db client/server
  clients.default = defaultDb.client
  servers.default = defaultDb.server
  server.client.db = defaultDb.client

  // Return cleanup function
  return async () => {
    await Promise.all([
      server.destroy(),
      configDb.destroy(),
      ...Object.values(clients).map((c) => c.destroy()),
      ...Object.values(servers).map((s) => s.destroy()),
    ])
  }
}

export default start
