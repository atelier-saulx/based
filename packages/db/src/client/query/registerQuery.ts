import { BasedDbQuery } from './BasedDbQuery.js'
import { queryToBuffer } from './toByteCode/toByteCode.js'
import { handleErrors } from './validation.js'
import { createQueryDef } from './queryDef.js'
import { QueryDefType, type QueryDef } from './types.js'
import { includeField } from './query.js'
import { convertToReaderSchema } from './queryDefToReadSchema.js'

export const registerQuery = (q: BasedDbQuery): Uint8Array => {
  if (!q.buffer) {
    const commands = q.queryCommands
    // @ts-ignore
    q.queryCommands = null
    const def = createQueryDef(
      q.db,
      QueryDefType.Root,
      // @ts-ignore
      q.target,
      q.skipValidation,
    )
    def.schemaChecksum = q.db.schema?.hash || 0
    q.def = def
    for (const command of commands) {
      q[command.method](...command.args)
    }
    if (!q.def.include.stringFields.size && !q.def.references.size) {
      includeField(q.def, { field: '*' })
    }
    q.queryCommands = commands

    const buf = queryToBuffer(q)
    q.buffer = buf
    // console.log(buf)
    // console.log('--------------------------------------------------')
    // console.dir(convertToReaderSchema(q.def), { depth: 100 })
    // const c = convertToReaderSchema(q.def)
    // const s = serialize(c)
    // console.log('--------------------------------------------------')
    // console.log(deSerializeSchema(s))
    // q.def.readSchema = deSerializeSchema(
    //   serialize(convertToReaderSchema(q.def)),
    // )
    // console.log('--------------------------------------------------')

    q.def.readSchema = convertToReaderSchema(q.def)
    handleErrors(q.def)
    return buf
  }
  handleErrors(q.def as QueryDef)
  return q.buffer
}
