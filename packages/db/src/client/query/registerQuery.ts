import { BasedDbQuery } from './BasedDbQuery.ts'
import { queryToBuffer } from './toByteCode/toByteCode.ts'
import { handleErrors } from './validation.ts'
import { createQueryDef } from './queryDef.ts'
import { QueryDefType } from './types.ts'
import { includeField } from './query.ts'
import { convertToReaderSchema } from './queryDefToReadSchema.ts'

export const registerQuery = (q: BasedDbQuery): Uint8Array => {
  if (!q.buffer) {
    const commands = q.queryCommands
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
  handleErrors(q.def)
  return q.buffer
}
