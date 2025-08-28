import { TypeIndex } from '@based/schema/prop-types'
import { ReaderPropDef, ReaderSchema } from '../types.js'
import { DECODER, readUint16 } from '@based/utils'

const PROPERTY_MAP = {
  meta: 1 << 0, // Bit 0
  enum: 1 << 1, // Bit 1
  vectorBaseType: 1 << 2, // Bit 2
  len: 1 << 3, // Bit 3
  locales: 1 << 4, // Bit 4
}

const readPath = (
  p: Uint8Array,
  off: number,
): { path: string[]; size: number } => {
  const len = p[off]
  const path = []
  let index = 1 + off
  while (path.length != len) {
    const propLen = p[index]
    path.push(DECODER.decode(p.subarray(index + 1, propLen + index + 1)))
    index += propLen + 1
  }
  return { path, size: index - off }
}

const deSerializeProp = (
  p: Uint8Array,
  off: number,
  keySize: 1 | 2,
): { def: ReaderPropDef; size: number; key: number } => {
  const path = readPath(p, off + 2 + keySize)
  const prop: ReaderPropDef = {
    typeIndex: p[off + keySize] as TypeIndex,
    path: path.path,
    readBy: 0,
  }

  const map = p[off + keySize + 1]
  let index = keySize + 2 + off + path.size

  // if (map & PROPERTY_MAP.meta) result.meta = {}
  // if (map & PROPERTY_MAP.enum) result.enum = []
  // if (map & PROPERTY_MAP.vectorBaseType) result.vectorBaseType = 'u8' // Default empty value
  // if (map & PROPERTY_MAP.len) result.len = 0
  // if (map & PROPERTY_MAP.locales) result.locales = {}
  const key = keySize === 1 ? p[off] : readUint16(p, off)
  return { def: prop, key, size: index - off }
}

export const deSerializeSchema = (
  schema: Uint8Array,
  offset: number = 0,
): ReaderSchema => {
  let i = offset
  const s: Partial<ReaderSchema> = {
    readId: 0,
    type: schema[i],
    search: schema[i + 1] === 1,
    refs: {},
    props: {},
    main: { len: 0, props: {} },
  }
  i += 2
  const ref = schema[i]
  i++
  if (ref !== 0) {
  }
  const propsLen = schema[i]
  i++
  if (propsLen) {
    let count = 0
    while (count != propsLen) {
      const { def, key, size } = deSerializeProp(schema, i, 1)
      s.props[key] = def
      i += size
      count++
    }
  }
  const mainLen = readUint16(schema, i)
  i += 2
  if (mainLen) {
    let count = 0
    const mainPropsLen = schema[i]
    s.main.len = mainLen
    i++
    while (count != mainPropsLen) {
      const { def, key, size } = deSerializeProp(schema, i, 2)
      s.main.props[key] = def
      i += size
      count++
    }
  }
  schema

  return s as ReaderSchema
}
