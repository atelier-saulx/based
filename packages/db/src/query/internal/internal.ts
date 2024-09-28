import { BasedDb } from '../../index.js'
import { addInclude } from './addInclude.js'
import { createQueryDef, debugQueryDef } from './queryDef.js'
import { QueryDefType, QueryDef } from './types.js'
import { includeFields } from './props.js'

export * from './queryDef.js'
export * from './types.js'
export * from './props.js'
export * from './addInclude.js'
export * from './addRefInclude.js'
export * from './filter/addFilter.js'
export * from './filter/toBuffer.js'

export const run = (db: BasedDb, type: string, fields: string[]): QueryDef => {
  console.log('flap')
  const def = createQueryDef(db, QueryDefType.Root, {
    type,
  })
  includeFields(def, fields)
  const buffer = addInclude(db, def)
  debugQueryDef(def)
  console.log('BUF', new Uint8Array(Buffer.concat(buffer)))
  return def
}
