import { convertToTimestamp } from '@saulx/utils'
import {
  BINARY,
  BOOLEAN,
  ENUM,
  INT16,
  INT32,
  INT8,
  NUMBER,
  PropDef,
  PropDefEdge,
  STRING,
  TIMESTAMP,
  UINT16,
  UINT32,
  UINT8,
} from './types.js'

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
    const s = f.start
    let val = f.default

    if (t === ENUM) {
      mainEmpty[s] = f.default ?? 0
    } else if (t === INT8 || t === UINT8) {
      mainEmpty[s] = val
    } else if (t === BOOLEAN) {
      mainEmpty[s] = val ? 1 : 0
    } else if (t === UINT32 || t === INT32) {
      mainEmpty[s] = val
      mainEmpty[s + 1] = val >>>= 8
      mainEmpty[s + 2] = val >>>= 8
      mainEmpty[s + 3] = val >>>= 8
    } else if (t === UINT16 || t === INT16) {
      mainEmpty[s] = val
      mainEmpty[s + 1] = val >>>= 8
    } else if (t === NUMBER || t === TIMESTAMP) {
      const view = new DataView(mainEmpty.buffer, s, 8)
      view.setFloat64(0, convertToTimestamp(val), true)
    } else if (t === STRING) {
      val = ENCODER.encode(val)
      mainEmpty[s] = val.byteLength
      mainEmpty.set(val, s + 1)
    } else if (t === BINARY) {
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
