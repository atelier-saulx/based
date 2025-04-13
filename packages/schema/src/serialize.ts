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
  fromObject: boolean,
  schemaBuffer: {
    buf: Uint8Array
    len: number
  },
) => {
  const isSchemaProp =
    'type' in obj && (prev?.type === 'object' || fromObject === false)

  if (isSchemaProp) {
    console.log('NEVCER')

    schemaBuffer.buf[schemaBuffer.len++] = 254
    const typeIndex = TYPE_INDEX_MAP[obj.type]
    schemaBuffer.buf[schemaBuffer.len++] = typeIndex
  } else {
    schemaBuffer.buf[schemaBuffer.len++] = 255
  }
  let sizeIndex = schemaBuffer.len

  schemaBuffer.len += 2

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
      // Max key size 255
      // add gaurd against that
      schemaBuffer.buf[s] = r.written

      const val = obj[key]
      const type = typeof val

      if (Array.isArray(val)) {
        // derp
      } else if (type === 'function') {
        // derp
      } else if (type === 'object') {
        // fromObject
        if (val === null) {
        } else {
          if (!fromObject && key === 'props' && obj.type === 'object') {
            walk(val, obj, true, schemaBuffer)
          } else {
            walk(val, obj, fromObject, schemaBuffer)
          }
        }
      } else if (type === 'string') {
        // console.log('flap', val)
        // schemaBuffer.len += 1
        // derp
      } else if (type === 'number') {
        // do stuff
      }
    }
  }
  const size = schemaBuffer.len - (sizeIndex + 2)

  schemaBuffer.buf[sizeIndex] = size
  schemaBuffer.buf[sizeIndex + 1] = size >>> 8

  console.log(obj, sizeIndex, size)
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

  walk(schema, undefined, false, schemaBuffer)

  return new Uint8Array(schemaBuffer.buf.subarray(0, schemaBuffer.len))
  // return new Uint8Array([isDeflate])
}

const decoder = new TextDecoder()

export const deSerializeInner = (
  buf: Uint8Array,
  obj: any,
  start: number,
  max: number,
): number => {
  // if first byte is deflate
  let i = start
  // buf bytlen only here as error...
  const isSchemaProp = buf[i] === 254
  i += 1

  if (isSchemaProp) {
    const type = buf[i]
    const parsedType = REVERSE_TYPE_INDEX_MAP[type]
    obj.type = parsedType
    i += 1
    const size = buf[i] | ((buf[i + 1] << 8) >>> 0)
    i += 2

    if (size === 0) {
      return i - start
    }

    for (; i < max + start; i++) {
      const keySize = buf[i]
      i++
      const key = decoder.decode(buf.subarray(i, keySize + i))
      i += keySize
      const nest = (obj[key] = {})
      i += deSerializeInner(buf, nest, i, size)
    }

    return i - start
  } else {
    const size = buf[i] | ((buf[i + 1] << 8) >>> 0)
    i += 2

    const len = size + i

    if (size === 0) {
      return i - start
    }

    for (; i < max + start; i++) {
      console.log('go get key', i)

      const keySize = buf[i]
      i++
      const key = decoder.decode(buf.subarray(i, keySize + i))
      i += keySize
      const nest = (obj[key] = {})
      console.log('  go deserialize', key, keySize, i)
      i += deSerializeInner(buf, nest, i, size)
    }
    return i - start
  }
}

export const deSerialize = (buf: Uint8Array): StrictSchema => {
  // if first byte is deflate
  const schema: any = {}
  deSerializeInner(buf, schema, 0, buf.byteLength)
  return schema as StrictSchema
}
