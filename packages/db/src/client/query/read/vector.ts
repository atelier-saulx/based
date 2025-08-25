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

export const vectorBaseTypeToReaderType = (
  vector: PropDef['vectorBaseType'],
): ReaderVectorBaseType => {
  switch (vector) {
    case 'int8':
      return ReaderVectorBaseType.Int8
    case 'uint8':
      return ReaderVectorBaseType.Uint8
    case 'int16':
      return ReaderVectorBaseType.Int16
    case 'uint16':
      return ReaderVectorBaseType.Uint16
    case 'int32':
      return ReaderVectorBaseType.Int32
    case 'uint32':
      return ReaderVectorBaseType.Uint32
    case 'float32':
      return ReaderVectorBaseType.Float32
    case 'float64':
      return ReaderVectorBaseType.Float64
    case 'number':
      return ReaderVectorBaseType.Float64
  }
}
