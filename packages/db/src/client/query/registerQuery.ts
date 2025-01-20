import native from '../../native.js'
import { BasedDbQuery } from './BasedDbQuery.js'
import { defToBuffer } from './toBuffer.js'
import { checkMaxBufferSize } from './validation.js'

export const registerQuery = (q: BasedDbQuery): Buffer => {
  // just add crc32 in the buffer

  const b = defToBuffer(q.db, q.def)
  const buf = Buffer.concat(b)
  let id = native.crc32(buf)
  q.id = id
  //   id = (id ^ q.def.schema.id) >>> 0
  // typeId, crc32, len
  // but want it to fit in a js number...
  // use 2 bytes for len and just continue counting
  //   const x = Buffer.allocUnsafe(8)
  //   // const number

  //   x.writeUint16LE(q.def.schema.id, 0)
  //   x.writeUint32LE(id, 2)
  //   x.writeUint16LE(buf.byteLength, 6)

  //   // ------------------------
  //   console.log('-> CRC32', { id, x: new Uint8Array(x), y: x.readFloatLE(0) })

  // do a test for
  //   console.log(id)

  // id, len, type as id?

  checkMaxBufferSize(buf)
  return buf
}
