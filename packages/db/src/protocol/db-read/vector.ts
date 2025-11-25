import { VectorBaseType } from '../../schema/index.js'
import { ReaderPropDef } from './types.js'

export const readVector = (prop: ReaderPropDef, tmp: Uint8Array) => {
  switch (prop.vectorBaseType) {
    case VectorBaseType.Int8:
      return new Int8Array(tmp.buffer, tmp.byteOffset, tmp.byteLength)
    case VectorBaseType.Uint8:
      return tmp
    case VectorBaseType.Int16:
      return new Int16Array(tmp.buffer)
    case VectorBaseType.Uint16:
      return new Uint16Array(tmp.buffer)
    case VectorBaseType.Int32:
      return new Int32Array(tmp.buffer)
    case VectorBaseType.Uint32:
      return new Uint32Array(tmp.buffer)
    case VectorBaseType.Float32:
      return new Float32Array(tmp.buffer)
    case VectorBaseType.Float64:
      return new Float64Array(tmp.buffer)
  }
}
