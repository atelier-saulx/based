export const SCHEMA_FILE_DEPRECATED = 'schema.json'
export const SCHEMA_FILE = 'schema.bin'
export const WRITELOG_FILE = 'writelog.json'
export const COMMON_SDB_FILE = 'common.sdb'

export const BLOCK_CAPACITY_MIN = 1025
export const BLOCK_CAPACITY_MAX = 2147483647
export const BLOCK_CAPACITY_DEFAULT = 100_000

export type BasedDbOpts = {
  path: string | null
  maxModifySize?: number
  debug?: boolean | 'server' | 'client'
  saveIntervalInSeconds?: number
}
