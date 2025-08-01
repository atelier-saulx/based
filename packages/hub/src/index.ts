import { BasedServer } from '@based/server'
import { createConfigDb } from './configDb.js'
import { handleSchemaUpdates } from './schemaManager.js'
import { BasedDb } from '@based/db'
import { join } from 'path'
import { initDynamicFunctions } from './functions/functions.js'
import { registerApiHandlers } from './api/api.js'
import type { S3Client } from '@based/s3'
import { createStatsDb } from './statsDb.js'
import { initDynamicFunctionsGlobals } from './functions/globalFn.js'

type Opts = {
  port: number
  path: string
  s3: S3Client
  buckets: Record<'files' | 'backups' | 'dists', string>
}

const start = async ({ port, path, s3, buckets }: Opts) => {
  const configDb = await createConfigDb(path)
  const statsDb = await createStatsDb(path)
  const server = new BasedServer({ port })
  // Handle schema updates and prepare client/server maps
  const { clients, servers } = await handleSchemaUpdates(configDb.client, path)
  const defaultDb = new BasedDb({ path: join(path, 'default') })
  // Register default db client/server
  clients.default = defaultDb.client
  servers.default = defaultDb.server
  server.client.db = defaultDb.client
  server.client.dbs = clients
  // Initialize dynamic functions and API handlers
  const { fnIds } = initDynamicFunctionsGlobals(statsDb.client)
  initDynamicFunctions(server, configDb.client, statsDb.client, fnIds)
  registerApiHandlers(server, configDb.client, statsDb.client, s3, buckets)
  await defaultDb.start()
  await server.start()
  // Return cleanup function
  return {
    configDb,
    statsDb,
    server,
    servers,
    clients,
    close: async () => {
      await Promise.all([
        server.destroy(),
        configDb.destroy(),
        statsDb.destroy(),
        ...Object.values(clients).map((c) => c.destroy()),
        ...Object.values(servers).map((s) => s.destroy()),
      ])
    },
  }
}

export default start
