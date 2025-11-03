import native from '../../native.js'
import { concatUint8Arr, writeUint32 } from '@based/utils'
import { BasedDbQuery } from './BasedDbQuery.js'
import { defToBuffer } from './toByteCode/toByteCode.js'
import { handleErrors } from './validation.js'
import { createQueryDef } from './queryDef.js'
import { QueryDefType } from './types.js'
import { includeField } from './query.js'
import { convertToReaderSchema } from './queryDefToReadSchema.js'

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
    const b = defToBuffer(q.db, q.def)
    const buf = concatUint8Arr(b)

    q.buffer = buf

    q.def.readSchema = convertToReaderSchema(q.def)
    handleErrors(q.def)
    return buf
  }
  handleErrors(q.def)
  return q.buffer
}
