import native from '../../native.js'
import { BasedDbQuery } from './BasedDbQuery.js'
import { defToBuffer } from './toBuffer.js'

export const registerQuery = (q: BasedDbQuery): Buffer => {
  if (!q.id) {
    const b = defToBuffer(q.db, q.def)
    const buf = Buffer.concat(b)
    let id = native.crc32(buf)
    q.id = id
    q.buffer = buf
    if (q.def.errors) {
      console.log('ERRORS', q.def.errors)
    }
    return buf
  }

  return q.buffer
}
