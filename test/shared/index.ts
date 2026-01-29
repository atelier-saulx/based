import type { ResolveSchema, SchemaIn } from '../../src/schema.js'
import { BasedDb, type DbClient } from '../../src/sdk.js'
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

export const testDb = async <S extends SchemaIn>(
  t,
  schema: S,
): Promise<DbClient<ResolveSchema<S>>> => {
  const db = new BasedDb({ path: t.tmp })
  await db.start({ clean: true })
  t.after(() => db.destroy())
  return db.setSchema(schema)
}
