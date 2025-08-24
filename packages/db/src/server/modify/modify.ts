import { readUint16, readUint32, readUint64, writeUint32 } from '@based/utils'
import native from '../../native.js'

export const modify = (
  dbCtx: any,
  schemaHash: number,
  payload: Uint8Array,
  parse: boolean,
  dirtyRanges: Float64Array<ArrayBufferLike>,
  queue?: Uint8Array[],
): Record<number, number> | void => {
  if (schemaHash !== readUint64(payload, 0)) {
    return
  }

  const contentEnd = readUint32(payload, payload.byteLength - 4)
  let result: Record<number, number>

  if (parse) {
    result = {}
    let i = payload.byteLength - 4
    while (i > contentEnd) {
      const typeId = readUint16(payload, i - 10)
      const initId = readUint32(payload, i - 8)
      const lastId = readUint32(payload, i - 4)
      const typeDef = native.getTypeInfo(typeId, dbCtx)

      if (!typeDef) {
        return
      }

      const offset = initId < typeDef.lastId ? typeDef.lastId - initId : 0
      // write the offset into payload for zig to use
      writeUint32(payload, offset, i - 4)
      result[typeId] = offset
      typeDef.lastId = lastId
      i -= 10
    }
  }

  if (queue) {
    queue.push(new Uint8Array(payload))
    return result
  }

  const content = payload.subarray(8, contentEnd)
  const offsets = payload.subarray(contentEnd, payload.byteLength - 4)
  native.modify(content, offsets, dbCtx, dirtyRanges)
  return result
}
