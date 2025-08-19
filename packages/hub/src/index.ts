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
import type SMTPConnection from 'nodemailer/lib/smtp-connection/index.js'

export type Opts = {
  port: number
  path: string
  s3: S3Client
  buckets: Record<'files' | 'backups' | 'dists', string>
  smtp: {
    auth: SMTPConnection.Options
  }
  console?: Console
}

const start = async ({ port, path, s3, buckets, smtp, console }: Opts) => {
  const configDb = await createConfigDb(path)
  const statsDb = await createStatsDb(path)
  const server = new BasedServer({ port, silent: true, console })
  // Handle schema updates and prepare client/server maps
  const { clients, servers } = await handleSchemaUpdates(configDb.client, path)
  const defaultDb = new BasedDb({ path: join(path, 'default') })
  // Register default db client/server
  clients.default = defaultDb.client
  servers.default = defaultDb.server
  server.client.db = defaultDb.client
  server.client.dbs = clients
  // Add deprecated things
  Object.defineProperty(server.client.db, 'v2', {
    configurable: true,
    get() {
      server.console.warn('based.db.v2 is deprecated, use based.db instead')
      Object.defineProperty(server.client.db, 'v2', { value: server.client.db })
      return server.client.db
    },
  })

  // Initialize dynamic functions and API handlers
  const { fnIds } = initDynamicFunctionsGlobals(statsDb.client)
  initDynamicFunctions(server, configDb.client, statsDb.client, fnIds)
  registerApiHandlers(
    server,
    configDb.client,
    statsDb.client,
    s3,
    buckets,
    smtp,
  )
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
