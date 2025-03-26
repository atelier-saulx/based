import {
  BINARY,
  BOOLEAN,
  CREATED,
  ENUM,
  INT16,
  INT32,
  INT8,
  NUMBER,
  PropDef,
  STRING,
  TIMESTAMP,
  UINT16,
  UINT32,
  UINT8,
  UPDATED,
} from './types.js'

// Lets add validation of values in here - need to validate DEFAULT!
export const ENCODER = new TextEncoder()

export const fillEmptyMain = (vals: PropDef[], mainLen: number) => {
  const mainEmpty = new Uint8Array(mainLen)
  for (const f of vals) {
    if (f.separate) {
      continue
    }
    const t = f.typeIndex
    const s = f.start
    let val = f.default
    if (t === BOOLEAN || t === INT8 || t === UINT8 || t === ENUM) {
      mainEmpty[s] = f.default
    } else if (t === UINT32 || t === INT32) {
      mainEmpty[s] = val
      mainEmpty[s + 1] = val >>>= 8
      mainEmpty[s + 2] = val >>>= 8
      mainEmpty[s + 3] = val >>>= 8
    } else if (t === UINT16 || t === INT16) {
      mainEmpty[s] = val
      mainEmpty[s + 1] = val >>>= 8
    } else if (
      t === NUMBER ||
      t === TIMESTAMP ||
      t === CREATED ||
      t === UPDATED
    ) {
      const view = new DataView(mainEmpty.buffer, s, 8)
      view.setFloat64(0, val, true)
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
