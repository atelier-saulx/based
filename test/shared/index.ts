import { createHash } from 'node:crypto'
import { getBlockHash, getBlockStatuses } from '../../src/db-server/blocks.js'
import type { ResolveSchema, SchemaIn, StrictSchema } from '../../src/schema.js'
import { BasedDb, DbServer, type DbClient } from '../../src/sdk.js'
import test from './test.js'
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
): Promise<DbClient<ResolveSchema<S>>> => {
  const db = new BasedDb({ path: t.tmp })
  await db.start({ clean: true })
  t.after(() => db.destroy())
  return db.setSchema(schema)
}

export async function countDirtyBlocks(server: DbServer) {
  let n = 0

  for (const t of Object.keys(server.schemaTypesParsedById)) {
    n += (await getBlockStatuses(server, Number(t))).reduce(
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
  const tc = db.schemaTypesParsed[typeName].id
  const capacity = db.schemaTypesParsed[typeName].blockCapacity
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
