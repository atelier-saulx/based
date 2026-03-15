import { DbServer } from './db-server/index.js'
import { DbClient } from './db-client/index.js'
import { getDefaultHooks } from './db-client/hooks.js'
export { DbClient, DbServer }
export type {
  BasedCreatePromise,
  BasedUpdatePromise,
  BasedDeletePromise,
  BasedUpsertPromise,
  BasedInsertPromise,
  ModifyOpts,
} from './db-client/index.js'
export type { InferPayload, InferTarget } from './db-client/modify/types.js'
export { xxHash64 } from './db-client/xxHash64.js'
export { crc32 } from './db-client/crc32.js'
export { default as createHash } from './db-server/dbHash.js'
export * from './utils/debug.js'
export * from './db-client/hooks.js'
export { BasedModify } from './db-client/modify/index.js'

export const SCHEMA_FILE = 'schema.bin'
export const COMMON_SDB_FILE = 'common.sdb'

export type BasedDbOpts = {
  path: string
  /** Minimum: 256 */
  maxModifySize?: number
  debug?: boolean | 'server' | 'client'
  saveIntervalInSeconds?: number
}

export { getDefaultHooks }
