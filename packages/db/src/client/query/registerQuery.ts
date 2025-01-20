import native from '../../native.js'
import { BasedDbQuery } from './BasedDbQuery.js'
import { defToBuffer } from './toBuffer.js'
import { QueryDef } from './types.js'
import { checkMaxBufferSize } from './validation.js'

// derp
// const id = crc32(buf)
// console.log('CRC32', { id })

export const registerQuery = (q: BasedDbQuery): Buffer => {
  // just add crc32 in the buffer

  const b = defToBuffer(q.db, q.def)
  const buf = Buffer.concat(b)
  const id = native.crc32(buf)

  // ------------------------
  console.log('-> CRC32', { id })

  checkMaxBufferSize(buf)
  return buf
}
