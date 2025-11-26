import { convertToTimestamp, writeInt64 } from '../../utils/index.js'
import { PropType } from '../../zigTsExports.js'
import { PropDef, PropDefEdge } from './types.js'

export const ENCODER = new TextEncoder()

export const fillEmptyMain = (
  vals: (PropDef | PropDefEdge)[],
  mainLen: number,
) => {
  const mainEmpty = new Uint8Array(mainLen)
  for (const f of vals) {
    if (f.separate) {
      continue
    }
    const t = f.typeIndex
    const s = f.start ?? 0
    let val = f.default

    if (t === PropType.enum) {
      mainEmpty[s] = f.default ?? 0
    } else if (t === PropType.int8 || t === PropType.uint8) {
      mainEmpty[s] = val
    } else if (t === PropType.boolean) {
      mainEmpty[s] = val ? 1 : 0
    } else if (t === PropType.uint32 || t === PropType.int32) {
      mainEmpty[s] = val
      mainEmpty[s + 1] = val >>>= 8
      mainEmpty[s + 2] = val >>>= 8
      mainEmpty[s + 3] = val >>>= 8
    } else if (t === PropType.uint16 || t === PropType.int16) {
      mainEmpty[s] = val
      mainEmpty[s + 1] = val >>>= 8
    } else if (t === PropType.timestamp) {
      writeInt64(mainEmpty, convertToTimestamp(val), s)
    } else if (t === PropType.number) {
      const view = new DataView(mainEmpty.buffer, s, 8)
      view.setFloat64(0, val, true)
    } else if (t === PropType.string) {
      val = ENCODER.encode(val)
      mainEmpty[s] = val.byteLength
      mainEmpty.set(val, s + 1)
    } else if (t === PropType.binary) {
      if (val !== undefined) {
        mainEmpty.set(val, s)
      }
    }
  }

  return mainEmpty
}

export const isZeroes = (buf: Uint8Array) => {
  let i = 0
  while (i < buf.byteLength) {
    if (buf[i] !== 0) {
      return false
    }
    i++
  }
  return true
}
