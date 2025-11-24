import { writeUint64 } from '@based/utils'
import { IntermediateByteCode, QueryDef } from '../types.js'

export const schemaChecksum = (def: QueryDef): IntermediateByteCode => {
  const checksum = new Uint8Array(8)
  writeUint64(checksum, def.schemaChecksum ?? 0, 0)
  return { buffer: checksum, def }
}

export const byteSize = (t: IntermediateByteCode) => {
  if (Array.isArray(t)) {
    return t.reduce((a, b) => {
      return a + byteSize(b)
    }, 0)
  } else if (t instanceof Uint8Array) {
    return t.byteLength
  } else {
    return t.buffer.byteLength
  }
}
