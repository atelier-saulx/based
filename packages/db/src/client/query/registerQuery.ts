import native from '../../native.js'
import { concatUint8Arr } from '@based/utils'
import { BasedDbQuery } from './BasedDbQuery.js'
import { defToBuffer } from './toByteCode/toByteCode.js'
import { handleErrors } from './validation.js'
import { createQueryDef } from './queryDef.js'
import { QueryDefType } from './types.js'
import { includeField } from './query.js'

export const registerQuery = (q: BasedDbQuery): Uint8Array => {
  if (!q.id) {
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
    // proposal:
    for (const command of commands) {
      q[command.method](...command.args)
    }
    // locale first...
    if (!q.def.include.stringFields.size && !q.def.references.size) {
      includeField(q.def, { field: '*' })
    }
    q.queryCommands = commands

    const b = defToBuffer(q.db, q.def)
    const buf = concatUint8Arr(b)
    let id = native.crc32(buf)
    q.id = id
    q.buffer = buf
    handleErrors(q.def)
    return buf
  }
  handleErrors(q.def)
  return q.buffer
}
