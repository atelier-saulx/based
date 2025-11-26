import { VectorBaseType } from '../../zigTsExports.js'
import { ReaderPropDef } from './types.js'

export const readVector = (prop: ReaderPropDef, tmp: Uint8Array) => {
  switch (prop.vectorBaseType) {
    case VectorBaseType.int8:
      return new Int8Array(tmp.buffer, tmp.byteOffset, tmp.byteLength)
    case VectorBaseType.uint8:
      return tmp
    case VectorBaseType.int16:
      return new Int16Array(tmp.buffer)
    case VectorBaseType.uint16:
      return new Uint16Array(tmp.buffer)
    case VectorBaseType.int32:
      return new Int32Array(tmp.buffer)
    case VectorBaseType.uint32:
      return new Uint32Array(tmp.buffer)
    case VectorBaseType.float32:
      return new Float32Array(tmp.buffer)
    case VectorBaseType.float64:
      return new Float64Array(tmp.buffer)
  }
}
