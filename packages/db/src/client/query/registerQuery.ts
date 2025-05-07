import native from '../../native.js'
import { concatUint8Arr, writeUint64 } from '@saulx/utils'
import { BasedDbQuery } from './BasedDbQuery.js'
import { defToBuffer } from './toBuffer.js'
import { handleErrors } from './validation.js'

export const registerQuery = (q: BasedDbQuery): Uint8Array => {
  if (!q.id) {
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
