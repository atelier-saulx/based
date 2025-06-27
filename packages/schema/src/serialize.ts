import * as deflate from 'fflate'
import { MAX_ID, MIN_ID, StrictSchema } from './types.js'
import { REVERSE_TYPE_INDEX_MAP, TYPE_INDEX_MAP } from './def/types.js'
import {
  readDoubleLE,
  readUint32,
  writeDoubleLE,
  writeUint32,
} from '@saulx/utils'

const ENCODER = new TextEncoder()

type SchemaBuffer = {
  buf: Uint8Array
  len: number
  dictMap: Record<string, number>
}

let schemaBuffer: SchemaBuffer

// encoding map

const handleSingleValue = (
  val: any,
  obj: any,
  prev: any,
  fromObject: boolean,
  key?: string | number,
) => {
  const type = typeof val
  // typed Array - single PROP
  if (val instanceof Uint8Array) {
    schemaBuffer.buf[schemaBuffer.len] = 251
    schemaBuffer.len += 1
    schemaBuffer.buf[schemaBuffer.len] = val.byteLength
    schemaBuffer.len += 1
    schemaBuffer.buf[schemaBuffer.len] = val.byteLength >>> 8
    schemaBuffer.len += 1
    schemaBuffer.buf.set(val, schemaBuffer.len)
    schemaBuffer.len += val.byteLength
  } else if (type === 'function') {
    const str = val.toString()
    schemaBuffer.buf[schemaBuffer.len] = 248
    schemaBuffer.len += 1
    const sizeIndex = schemaBuffer.len
    schemaBuffer.len += 2
    const r = ENCODER.encodeInto(
      str,
      schemaBuffer.buf.subarray(schemaBuffer.len),
    )
    schemaBuffer.len += r.written
    schemaBuffer.buf[sizeIndex] = r.written
    schemaBuffer.buf[sizeIndex + 1] = r.written >>> 8
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
  } else if (type === 'boolean') {
    schemaBuffer.buf[schemaBuffer.len] = val ? 247 : 246
    schemaBuffer.len += 1
  } else if (type === 'string') {
    // compress if large! (for descriptions etc)
    schemaBuffer.buf[schemaBuffer.len] = 249
    schemaBuffer.len += 1
    const sizeIndex = schemaBuffer.len
    schemaBuffer.len += 2
    const r = ENCODER.encodeInto(
      val,
      schemaBuffer.buf.subarray(schemaBuffer.len),
    )
    schemaBuffer.len += r.written
    schemaBuffer.buf[sizeIndex] = r.written
    schemaBuffer.buf[sizeIndex + 1] = r.written >>> 8
  } else if (type === 'number') {
    if ((val < 4294967295 || val > 0) && val % 1 === 0) {
      schemaBuffer.buf[schemaBuffer.len] = 252
      schemaBuffer.len += 1
      writeUint32(schemaBuffer.buf, val, schemaBuffer.len)
      schemaBuffer.len += 4
    } else {
      schemaBuffer.buf[schemaBuffer.len] = 253
      schemaBuffer.len += 1
      writeDoubleLE(schemaBuffer.buf, val, schemaBuffer.len)
      schemaBuffer.len += 8
    }
  }
}

// 3 level
// 0 for queries (min)
// 1 for modify
// 2 fulls schema
const walk = (
  obj: any,
  prev: any,
  prev2: any,
  fromObject: boolean,
  schemaBuffer: SchemaBuffer,
) => {
  let start = schemaBuffer.len

  const isArray = Array.isArray(obj)
  // HANDLE ENUM
  const isSchemaProp =
    'type' in obj && (prev2?.type === 'object' || fromObject === false)

  if (isSchemaProp) {
    schemaBuffer.buf[schemaBuffer.len++] = 254
    const typeIndex = TYPE_INDEX_MAP[obj.type]
    schemaBuffer.buf[schemaBuffer.len++] = typeIndex
  } else {
    schemaBuffer.buf[schemaBuffer.len++] = isArray ? 250 : 255
  }
  let sizeIndex = schemaBuffer.len
  schemaBuffer.len += 2

  if (isArray) {
    const len = obj.length
    // TODO add len makes it faster
    for (let j = 0; j < len; j++) {
      writeUint32(schemaBuffer.buf, j, schemaBuffer.len)
      schemaBuffer.len += 4
      handleSingleValue(obj[j], obj, prev, fromObject, j)
    }
  } else {
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
        handleSingleValue(obj[key], obj, prev, fromObject, key)
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

// can just make it non schema specific
export const deSerializeInner = (
  buf: Uint8Array,
  obj: any,
  start: number,
  fromArray: boolean,
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
    let key: string | number
    if (fromArray) {
      key = readUint32(buf, i)
      i += 4
    } else {
      let keySize = buf[i]
      i += 1
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
    }

    if (buf[i] == 246) {
      i += 1
      obj[key] = false
    } else if (buf[i] == 247) {
      i += 1
      obj[key] = true
    } else if (buf[i] == 248) {
      i += 1
      const size = buf[i] | ((buf[i + 1] << 8) >>> 0)
      i += 2
      const fn = `return (${decoder.decode(buf.subarray(i, i + size))})(payload, prop)`
      console.log(fn)
      obj[key] = new Function('payload', 'prop', fn)
      i += size
    } else if (buf[i] == 249) {
      i += 1
      const size = buf[i] | ((buf[i + 1] << 8) >>> 0)
      i += 2
      obj[key] = decoder.decode(buf.subarray(i, i + size))
      i += size
    } else if (buf[i] === 251) {
      i += 1
      const size = buf[i] | ((buf[i + 1] << 8) >>> 0)
      i += 2
      obj[key] = buf.subarray(i, size + i)
      i += size
    } else if (buf[i] === 252) {
      obj[key] = readUint32(buf, i + 1)
      i += 5
    } else if (buf[i] === 253) {
      obj[key] = readDoubleLE(buf, i + 1)
      i += 9
    } else if (buf[i] === 255 || buf[i] === 254) {
      const nest = (obj[key] = {})
      const fieldSize = deSerializeInner(buf, nest, i, false)
      i += fieldSize
    } else if (buf[i] === 250) {
      const nest = (obj[key] = [])
      const fieldSize = deSerializeInner(buf, nest, i, true)
      i += fieldSize
    } else {
      console.warn('Invalid value type', buf[i], 'skip')
      // invaid value
      i += 1
      const size = buf[i] | ((buf[i + 1] << 8) >>> 0)
      i += size
    }
  }
  return i - start
}

export const deSerialize = (buf: Uint8Array): StrictSchema => {
  // if first byte is deflate
  const schema: any = {}
  deSerializeInner(buf, schema, 0, false)
  return schema as StrictSchema
}
