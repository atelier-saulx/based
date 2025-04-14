import * as deflate from 'fflate'
import { StrictSchema } from './types.js'
import { REVERSE_TYPE_INDEX_MAP, TYPE_INDEX_MAP } from './def/types.js'

const hasNative = '__basedDb__native__' in global

const ENCODER = new TextEncoder()

let schemaBuffer: {
  buf: Uint8Array
  len: number
}

const walk = (
  obj,
  prev: any,
  prev2: any,
  fromObject: boolean,
  schemaBuffer: {
    buf: Uint8Array
    len: number
  },
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

  // handle dope props
  for (const key in obj) {
    if (key === 'type') {
      if (isSchemaProp) {
        continue
      }
    } else {
      const s = schemaBuffer.len++
      const r = ENCODER.encodeInto(
        key,
        schemaBuffer.buf.subarray(schemaBuffer.len),
      )
      schemaBuffer.len += r.written
      schemaBuffer.buf[s] = r.written
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
    // 10mb buffer
    schemaBuffer = { buf: new Uint8Array(1e7), len: 0 }
  }

  schemaBuffer.len = 0

  const isDeflate = noCompression ? 0 : 1

  const arr: Uint8Array[] = []

  walk(schema, undefined, undefined, false, schemaBuffer)

  if (isDeflate) {
    return deflate.deflateSync(
      new Uint8Array(schemaBuffer.buf.subarray(0, schemaBuffer.len)),
    )
  } else {
    return new Uint8Array(schemaBuffer.buf.subarray(0, schemaBuffer.len))
  }
}

const decoder = new TextDecoder()

// add dict
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
    const keySize = buf[i]
    i += 1
    const key = decoder.decode(buf.subarray(i, keySize + i))
    i += keySize
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
