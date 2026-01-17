import { writeUint64 } from '../../../utils/index.js'
import { IntermediateByteCode, QueryDef } from '../types.js'

export const schemaChecksum = (def: QueryDef): IntermediateByteCode => {
  const checksum = new Uint8Array(8)
  writeUint64(checksum, def.schemaChecksum ?? 0, 0)
  return checksum
}

export const byteSize = (t: IntermediateByteCode) => {
  if (Array.isArray(t)) {
    return t.reduce((a, b) => {
      return a + byteSize(b)
    }, 0)
  } else {
    return t.byteLength
  }
}
