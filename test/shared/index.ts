import { createHash } from 'node:crypto'
import { getBlockHash, getBlockStatuses } from '../../src/db-server/blocks.js'
import type {
  ResolveSchema,
  SchemaIn,
  StrictSchema,
} from '../../src/schema/index.js'
import { DbClient, DbServer, getDefaultHooks } from '../../src/sdk.js'
import test from './test.js'
import { getTypeDefs } from '../../src/schema/defs/getTypeDefs.js'
import { BLOCK_CAPACITY_DEFAULT } from '../../src/db-server/schema.js'
export * from './assert.js'
export * from './examples.js'
export * from './examples.js'
export * from './startWorker.js'
export * from './multi.js'
export { test }

const formatBytes = (bytes: number) => {
  if (bytes < 1024) {
    return bytes + ' Bytes'
  } else if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(2) + ' KB'
  } else if (bytes < 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  } else {
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
  }
}

export function logMemoryUsage() {
  const memoryUsage = process.memoryUsage()

  console.log('Memory Usage:')
  console.log(`  rss: ${formatBytes(memoryUsage.rss)}`)
  console.log(`  heapTotal: ${formatBytes(memoryUsage.heapTotal)}`)
  console.log(`  heapUsed: ${formatBytes(memoryUsage.heapUsed)}`)
  console.log(`  external: ${formatBytes(memoryUsage.external)}`)
  if (memoryUsage.arrayBuffers !== undefined) {
    console.log(`  arrayBuffers: ${formatBytes(memoryUsage.arrayBuffers)}`)
  }
}

export const testDb = async <const S extends SchemaIn>(
  t: Parameters<Parameters<typeof test>[1]>[0],
  schema: StrictSchema<S>,
  opts: { noBackup?: boolean; noClean?: boolean; path?: string } = {},
): Promise<DbClient<ResolveSchema<S>>> => {
  const server = await testDbServer(t, opts)
  return testDbClient(server, schema)
}

export const testDbClient = async <const S extends SchemaIn>(
  server: DbServer,
  schema?: StrictSchema<S>,
): Promise<DbClient<ResolveSchema<S>>> => {
  const client = new DbClient({
    hooks: getDefaultHooks(server),
  })
  if (schema) {
    await client.setSchema(schema)
  }
  return client as DbClient<ResolveSchema<S>>
}

export const testDbServer = async <const S extends SchemaIn>(
  t: Parameters<Parameters<typeof test>[1]>[0],
  opts: { noBackup?: boolean; noClean?: boolean; path?: string } = {},
): Promise<DbServer> => {
  const db = new DbServer({ path: opts.path ?? t.tmp })
  await db.start({ clean: !opts.noClean })
  if (opts.noBackup) {
    t.after(() => db.destroy())
  } else {
    t.after(() => t.backup(db))
  }
  return db
}

export async function countDirtyBlocks(server: DbServer) {
  let n = 0
  const typeDefs = getTypeDefs(server.schema!)
  for (const [key, typeDef] of typeDefs) {
    n += (await getBlockStatuses(server, Number(typeDef.id))).reduce(
      (acc, cur) => acc + ~~!!(cur & 0x4),
      0,
    )
  }

  return n
}

export const getActiveBlocks = async (
  db: DbServer,
  tc: number,
): Promise<Array<number>> =>
  (await getBlockStatuses(db, tc)).reduce((acc, cur, i) => {
    if (cur) {
      acc.push(i)
    }
    return acc
  }, [] as Array<number>)

const block2start = (block: number, capacity: number): number =>
  block * capacity + 1

export const hashType = async (
  db: DbServer,
  typeName: string,
): Promise<string> => {
  const typeDefs = getTypeDefs(db.schema!)
  const typeDef = typeDefs.get(typeName)!
  const tc = typeDef.id
  const capacity = typeDef.schema.blockCapacity || BLOCK_CAPACITY_DEFAULT
  const hash = createHash('sha256')
  const bhs = await Promise.all(
    (await getActiveBlocks(db, tc)).map((block) =>
      getBlockHash(db, tc, block2start(block, capacity)),
    ),
  )
  for (const bh of bhs) {
    hash.update(bh)
  }
  return hash.digest('hex')
}
