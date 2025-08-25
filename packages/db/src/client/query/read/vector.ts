import { PropDef } from '@based/schema/def'
import { ReaderPropDef, ReaderVectorBaseType } from './types.js'

export const readVector = (prop: ReaderPropDef, tmp: Uint8Array) => {
  switch (prop.vectorBaseType) {
    case ReaderVectorBaseType.Int8:
      return new Int8Array(tmp.buffer, tmp.byteOffset, tmp.byteLength)
    case ReaderVectorBaseType.Uint8:
      return tmp
    case ReaderVectorBaseType.Int16:
      return new Int16Array(tmp.buffer)
    case ReaderVectorBaseType.Uint16:
      return new Uint16Array(tmp.buffer)
    case ReaderVectorBaseType.Int32:
      return new Int32Array(tmp.buffer)
    case ReaderVectorBaseType.Uint32:
      return new Uint32Array(tmp.buffer)
    case ReaderVectorBaseType.Float32:
      return new Float32Array(tmp.buffer)
    case ReaderVectorBaseType.Float64:
      return new Float64Array(tmp.buffer)
  }
}
