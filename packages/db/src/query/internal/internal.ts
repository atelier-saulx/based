import { BasedDb } from '../../index.js'
import { defToBuffer } from './toBuffer.js'
import { createQueryDef, debugQueryDef } from './queryDef.js'
import { QueryDefType, QueryDef } from './types.js'
import { includeFields } from './include/props.js'

export * from './queryDef.js'
export * from './types.js'
export * from './include/props.js'
export * from './include/toBuffer.js'
export * from './toBuffer.js'
export * from './filter/filter.js'
export * from './filter/toBuffer.js'

export const run = (db: BasedDb, type: string, fields: string[]): QueryDef => {
  console.log('flap')
  const def = createQueryDef(db, QueryDefType.Root, {
    type,
  })
  includeFields(def, fields)
  const buffer = defToBuffer(db, def)
  debugQueryDef(def)
  console.log('BUF', new Uint8Array(Buffer.concat(buffer)))
  return def
}
