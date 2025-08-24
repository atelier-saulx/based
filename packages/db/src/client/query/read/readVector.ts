import { ReaderPropDef } from './types.js'

export const readVector = (prop: ReaderPropDef, tmp: Uint8Array) => {
  switch (prop.vectorBaseType) {
    case 'int8':
      return new Int8Array(tmp)
    case 'uint8':
      return new Uint8Array(tmp)
    case 'int16':
      return new Int16Array(tmp)
    case 'uint16':
      return new Uint16Array(tmp)
    case 'int32':
      return new Int32Array(tmp)
    case 'uint32':
      return new Uint32Array(tmp)
    case 'float32':
      return new Float32Array(tmp)
    case 'float64':
    case 'number':
      return new Float64Array(tmp)
  }
}
