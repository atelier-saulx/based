export const SCHEMA_FILE_DEPRECATED = 'schema.json'
export const SCHEMA_FILE = 'schema.bin'
export const WRITELOG_FILE = 'writelog.json'
export const COMMON_SDB_FILE = 'common.sdb'

export type BasedDbOpts = {
  path: string | null
  maxModifySize?: number
  debug?: boolean | 'server' | 'client'
  saveIntervalInSeconds?: number
}
