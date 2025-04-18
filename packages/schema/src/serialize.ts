import * as deflate from 'fflate'
import { StrictSchema } from './types.js'
import { REVERSE_TYPE_INDEX_MAP, TYPE_INDEX_MAP } from './def/types.js'

// const hasNative = '__basedDb__native__' in global

const ENCODER = new TextEncoder()

type SchemaBuffer = {
  buf: Uint8Array
  len: number
  dictMap: Record<string, number>
}

let schemaBuffer: SchemaBuffer

// 3 level
// 0 for queries (min)
// 1 for modify
// 2 fulls schema
const walk = (
  obj,
  prev: any,
  prev2: any,
  fromObject: boolean,
  schemaBuffer: SchemaBuffer,
) => {
  let start = schemaBuffer.len

  // HANDLE ENUM
  const isSchemaProp =
    'type' in obj && (prev2?.type === 'object' || fromObject === false)
  if (isSchemaProp) {
    schemaBuffer.buf[schemaBuffer.len++] = 254
    const typeIndex = TYPE_INDEX_MAP[obj.type]
    schemaBuffer.buf[schemaBuffer.len++] = typeIndex
  } else {
    schemaBuffer.buf[schemaBuffer.len++] = 255
  }
  let sizeIndex = schemaBuffer.len
  schemaBuffer.len += 2

  for (const key in obj) {
    if (key === 'type' && isSchemaProp) {
      continue
    } else {
      let address = schemaBuffer.dictMap[key]
      // if len == 1 never from address
      if (!address) {
        address = schemaBuffer.len
        schemaBuffer.len += 1
        const r = ENCODER.encodeInto(
          key,
          schemaBuffer.buf.subarray(schemaBuffer.len),
        )
        schemaBuffer.buf[address] = r.written
        schemaBuffer.len += r.written
        schemaBuffer.dictMap[key] = address
      } else {
        schemaBuffer.buf[schemaBuffer.len] = 0
        schemaBuffer.len += 1
        schemaBuffer.buf[schemaBuffer.len] = address
        schemaBuffer.buf[schemaBuffer.len + 1] = address >>> 8
        schemaBuffer.len += 2
      }

      const val = obj[key]
      const type = typeof val
      // typed Array
      if (Array.isArray(val)) {
        // derp
      } else if (type === 'function') {
        // derp
      } else if (type === 'object') {
        // fromObject
        if (val === null) {
        } else {
          if (!fromObject && key === 'props' && obj.type === 'object') {
            walk(val, obj, prev, true, schemaBuffer)
          } else {
            walk(val, obj, prev, fromObject, schemaBuffer)
          }
        }
      } else if (type === 'string') {
        // derp
      } else if (type === 'number') {
        // do stuff
      }
    }
  }
  const size = schemaBuffer.len - start

  schemaBuffer.buf[sizeIndex] = size
  schemaBuffer.buf[sizeIndex + 1] = size >>> 8
}

export const serialize = (
  schema: any,
  // schema: StrictSchema,
  noCompression: boolean = false,
): Uint8Array => {
  if (!schemaBuffer) {
    // 1mb buffer add check if its large enough else increase
    schemaBuffer = {
      buf: new Uint8Array(1e6),
      len: 0,
      dictMap: {},
    }
  }
  schemaBuffer.dictMap = {}
  schemaBuffer.len = 0
  const isDeflate = noCompression ? 0 : 1
  walk(schema, undefined, undefined, false, schemaBuffer)
  const packed = new Uint8Array(schemaBuffer.buf.subarray(0, schemaBuffer.len))
  if (isDeflate) {
    return deflate.deflateSync(packed)
  } else {
    return packed
  }
}

const decoder = new TextDecoder()

export const deSerializeInner = (
  buf: Uint8Array,
  obj: any,
  start: number,
): number => {
  let i = start
  const isSchemaProp = buf[i] === 254
  i += 1
  if (isSchemaProp) {
    const type = buf[i]
    const parsedType = REVERSE_TYPE_INDEX_MAP[type]
    obj.type = parsedType
    i += 1
  }
  const size = buf[i] | ((buf[i + 1] << 8) >>> 0)
  i += 2
  const end = size + start
  while (i < end) {
    let keySize = buf[i]
    i += 1
    let key: string
    if (keySize === 0) {
      const dictAddress = buf[i] | ((buf[i + 1] << 8) >>> 0)
      i += 2
      keySize = buf[dictAddress]
      key = decoder.decode(
        buf.subarray(dictAddress + 1, keySize + dictAddress + 1),
      )
    } else {
      key = decoder.decode(buf.subarray(i, keySize + i))
      i += keySize
    }

    const nest = (obj[key] = {})
    const fieldSize = deSerializeInner(buf, nest, i)
    i += fieldSize
  }
  return i - start
}

export const deSerialize = (buf: Uint8Array): StrictSchema => {
  // if first byte is deflate
  const schema: any = {}
  deSerializeInner(buf, schema, 0)
  return schema as StrictSchema
}
