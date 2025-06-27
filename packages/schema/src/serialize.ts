import * as deflate from 'fflate'
import { StrictSchema, stringFormats } from './types.js'
import { REVERSE_TYPE_INDEX_MAP, TYPE_INDEX_MAP } from './def/types.js'
import {
  readDoubleLE,
  readUint16,
  readUint24,
  readUint32,
  writeDoubleLE,
  writeUint16,
  writeUint32,
} from '@saulx/utils'

const ENCODER = new TextEncoder()

const UINT8 = 245
const FALSE = 246
const TRUE = 247
const FUNCTION = 248
const STRING = 249
const ARRAY = 250
const BINARY = 251
const UINT32 = 252
const FLOAT64 = 253
const SCHEMA_PROP = 254
const OBJECT = 255

const KEY_OPTS = 9

type SchemaBuffer = {
  buf: Uint8Array
  len: number
  refMap: Record<string, number>
  dictMap: Record<string, number>
  inverseRefMap: Record<string, number[]>
}

const ensureCapacity = (required: number) => {
  if (schemaBuffer.len + required > schemaBuffer.buf.length) {
    const newBuf = new Uint8Array(
      Math.max(schemaBuffer.buf.length * 2, schemaBuffer.len + required),
    )
    newBuf.set(schemaBuffer.buf)
    schemaBuffer.buf = newBuf
  }
}

let schemaBuffer: SchemaBuffer

const handleSingleValue = (
  ops: Opts,
  val: any,
  obj: any,
  prev: any,
  fromObject: boolean,
  key?: string | number,
  isTypes?: boolean,
) => {
  const type = typeof val
  // typed Array - single PROP
  if (val instanceof Uint8Array) {
    ensureCapacity(1 + 2 + val.byteLength)
    schemaBuffer.buf[schemaBuffer.len] = BINARY
    schemaBuffer.len += 1
    schemaBuffer.buf[schemaBuffer.len] = val.byteLength
    schemaBuffer.len += 1
    schemaBuffer.buf[schemaBuffer.len] = val.byteLength >>> 8
    schemaBuffer.len += 1
    schemaBuffer.buf.set(val, schemaBuffer.len)
    schemaBuffer.len += val.byteLength
  } else if (type === 'function') {
    const str = val.toString()
    // Pessimistically assume 4 bytes per char for UTF-8 to be safe.
    ensureCapacity(1 + 2 + str.length * 4)
    schemaBuffer.buf[schemaBuffer.len] = FUNCTION
    schemaBuffer.len += 1
    const sizeIndex = schemaBuffer.len
    schemaBuffer.len += 2
    // encodeInto is much faster as it avoids intermediate allocation.
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
        walk(ops, val, obj, prev, true, schemaBuffer, false)
      } else {
        walk(ops, val, obj, prev, fromObject, schemaBuffer, isTypes)
      }
    }
  } else if (type === 'boolean') {
    ensureCapacity(1)
    schemaBuffer.buf[schemaBuffer.len] = val ? TRUE : FALSE
    schemaBuffer.len += 1
  } else if (type === 'string') {
    // compress if large! (for descriptions etc)
    // Pessimistically assume 4 bytes per char for UTF-8 to be safe.
    ensureCapacity(1 + 2 + val.length * 4)
    schemaBuffer.buf[schemaBuffer.len] = STRING
    schemaBuffer.len += 1
    const sizeIndex = schemaBuffer.len
    schemaBuffer.len += 2
    // encodeInto is much faster as it avoids intermediate allocation.
    const r = ENCODER.encodeInto(
      val,
      schemaBuffer.buf.subarray(schemaBuffer.len),
    )
    schemaBuffer.len += r.written
    schemaBuffer.buf[sizeIndex] = r.written
    schemaBuffer.buf[sizeIndex + 1] = r.written >>> 8
  } else if (type === 'number') {
    const isInt = val % 1 === 0

    if (val < 256 && val > 0 && isInt) {
      ensureCapacity(2)
      schemaBuffer.buf[schemaBuffer.len] = UINT8
      schemaBuffer.len += 1
      schemaBuffer.buf[schemaBuffer.len] = val
      schemaBuffer.len += 1
    } else if ((val < 4294967295 || val > 0) && isInt) {
      ensureCapacity(5)
      schemaBuffer.buf[schemaBuffer.len] = UINT32
      schemaBuffer.len += 1
      writeUint32(schemaBuffer.buf, val, schemaBuffer.len)
      schemaBuffer.len += 4
    } else {
      ensureCapacity(9)
      schemaBuffer.buf[schemaBuffer.len] = FLOAT64
      schemaBuffer.len += 1
      writeDoubleLE(schemaBuffer.buf, val, schemaBuffer.len)
      schemaBuffer.len += 8
    }
  }
}

type Opts = {
  deflate?: boolean
  readOnly?: boolean
  stripMetaInformation?: boolean
}

// 3 level
// 0 for queries (min)
// 1 for modify
// 2 fulls schema
const walk = (
  opts: Opts,
  obj: any,
  prev: any,
  prev2: any,
  fromObject: boolean,
  schemaBuffer: SchemaBuffer,
  isTypes: boolean,
) => {
  let start = schemaBuffer.len

  const isArray = Array.isArray(obj)
  const isFromObj = prev2?.type === 'object' || fromObject === false
  const isSchemaProp = 'type' in obj && isFromObj

  ensureCapacity(1 + 4) // Type byte + size
  if (isSchemaProp) {
    schemaBuffer.buf[schemaBuffer.len++] = SCHEMA_PROP
    const typeIndex = TYPE_INDEX_MAP[obj.type]
    schemaBuffer.buf[schemaBuffer.len++] = typeIndex
  } else {
    schemaBuffer.buf[schemaBuffer.len++] = isArray ? ARRAY : OBJECT
  }
  let sizeIndex = schemaBuffer.len
  schemaBuffer.len += 2

  if (isArray) {
    const len = obj.length
    ensureCapacity(2 * len + 2)
    writeUint16(schemaBuffer.buf, len, schemaBuffer.len)
    schemaBuffer.len += 2
    for (let j = 0; j < len; j++) {
      if (len < 256) {
        schemaBuffer.buf[schemaBuffer.len] = j
        schemaBuffer.len += 1
      } else {
        writeUint16(schemaBuffer.buf, j, schemaBuffer.len)
        schemaBuffer.len += 2
      }
      handleSingleValue(opts, obj[j], obj, prev, fromObject, j)
    }
  } else {
    for (const key in obj) {
      // if (isTypes) {
      //   schemaBuffer.dictMap[key] = schemaBuffer.len
      // }

      if (
        opts.readOnly &&
        isFromObj &&
        (key === 'validation' || key === 'default')
      ) {
        if (key === 'validation' && typeof obj[key] === 'function') {
          continue
        } else if (key === 'default') {
          continue
        }
      } else if (
        isFromObj &&
        (opts.stripMetaInformation || opts.readOnly) &&
        (key === 'title' ||
          key === 'description' ||
          key === 'format' ||
          key === 'display') &&
        typeof obj[key] === 'string'
      ) {
        continue
      } else if (key === 'type' && isSchemaProp) {
        continue
      } else if (key === 'required' && obj[key] === true) {
        ensureCapacity(1)
        schemaBuffer.buf[schemaBuffer.len] = 7
        schemaBuffer.len += 1
        continue
      }
      // Add this later
      // else if (key == 'ref' && typeof obj[key] === 'string' && isFromObj) {
      //   // do something...
      //   console.log('YO ----->', obj)
      //   schemaBuffer.buf[schemaBuffer.len] = 8
      //   // address
      //   continue
      // }
      else if (key === 'readOnly' && obj[key] === true) {
        ensureCapacity(1)
        schemaBuffer.buf[schemaBuffer.len] = 5
        schemaBuffer.len += 1
        continue
      } else if (key === 'format' && isFromObj) {
        ensureCapacity(2)
        schemaBuffer.buf[schemaBuffer.len] = 6
        schemaBuffer.len += 1
        schemaBuffer.buf[schemaBuffer.len] = stringFormats.indexOf(obj.format)
        schemaBuffer.len += 1
        continue
      } else {
        let isTypes = false
        if (key === 'types') {
          //  undefined undefined false
          if (!prev && !prev2 && !fromObject) {
            isTypes = true
          }
          ensureCapacity(1)
          schemaBuffer.buf[schemaBuffer.len] = 4
          schemaBuffer.len += 1
        } else if (key === 'props') {
          ensureCapacity(1)
          schemaBuffer.buf[schemaBuffer.len] = 3
          schemaBuffer.len += 1
        } else if (key === 'prop') {
          ensureCapacity(1)
          schemaBuffer.buf[schemaBuffer.len] = 9
          schemaBuffer.len += 1
        } else {
          let address = schemaBuffer.dictMap[key]
          // if len == 1 never from address
          if (!address) {
            // pessimistically assume 4 bytes per char for UTF-8 to be safe.
            ensureCapacity(1 + key.length * 4)
            address = schemaBuffer.len
            schemaBuffer.len += 1
            const r = ENCODER.encodeInto(
              key,
              schemaBuffer.buf.subarray(schemaBuffer.len),
            )
            schemaBuffer.buf[address] = r.written + KEY_OPTS
            schemaBuffer.len += r.written
            schemaBuffer.dictMap[key] = address
          } else {
            ensureCapacity(4)
            if (address > 65025) {
              schemaBuffer.buf[schemaBuffer.len] = 2
              schemaBuffer.len += 1
              schemaBuffer.buf[schemaBuffer.len] = address
              schemaBuffer.buf[schemaBuffer.len + 1] = address >>> 8
              schemaBuffer.buf[schemaBuffer.len + 2] = address >>> 16
              schemaBuffer.len += 3
            } else if (address > 255) {
              schemaBuffer.buf[schemaBuffer.len] = 1
              schemaBuffer.len += 1
              schemaBuffer.buf[schemaBuffer.len] = address
              schemaBuffer.buf[schemaBuffer.len + 1] = address >>> 8
              schemaBuffer.len += 2
            } else {
              schemaBuffer.buf[schemaBuffer.len] = 0
              schemaBuffer.len += 1
              schemaBuffer.buf[schemaBuffer.len] = address
              schemaBuffer.len += 1
            }
          }
        }
        handleSingleValue(opts, obj[key], obj, prev, fromObject, key, isTypes)
      }
    }
  }

  let size = schemaBuffer.len - start
  schemaBuffer.buf[sizeIndex] = size
  schemaBuffer.buf[sizeIndex + 1] = size >>> 8
}

export const serialize = (schema: any, opts: Opts = {}): Uint8Array => {
  if (!schemaBuffer) {
    schemaBuffer = {
      buf: new Uint8Array(10e3), // 10kb default
      len: 0,
      dictMap: {},
      refMap: {},
      inverseRefMap: {},
    }
  }
  schemaBuffer.refMap = {}
  schemaBuffer.dictMap = {}
  schemaBuffer.inverseRefMap = {}
  schemaBuffer.len = 0
  const isDeflate = opts.deflate ? 1 : 0
  walk(opts, schema, undefined, undefined, false, schemaBuffer, false)
  const packed = new Uint8Array(schemaBuffer.buf.subarray(0, schemaBuffer.len))
  if (isDeflate) {
    // add extra byte! see if nessecary
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
  fromArray: boolean,
): number => {
  let i = start
  const isSchemaProp = buf[i] === SCHEMA_PROP
  i += 1

  if (isSchemaProp) {
    const type = buf[i]
    const parsedType = REVERSE_TYPE_INDEX_MAP[type]
    obj.type = parsedType
    i += 1
  }

  const size = readUint16(buf, i)
  i += 2

  const end = size + start

  if (fromArray) {
    i += 2
  }

  while (i < end) {
    let key: string | number
    if (fromArray) {
      if (obj.length < 256) {
        key = buf[i]
        i += 1
      } else {
        key = readUint16(buf, i)
        i += 2
      }
    } else {
      let keySize = buf[i]
      i += 1
      // format!
      if (keySize === 7) {
        obj.required = true
        continue
      } else if (keySize === 6) {
        obj.format = stringFormats[buf[i]]
        i += 1
        continue
      } else if (keySize === 5) {
        obj.readOnly = true
        continue
      } else if (keySize === 4) {
        key = 'types'
      } else if (keySize === 3) {
        key = 'props'
      } else if (keySize === 9) {
        key = 'prop'
      } else if (keySize === 2) {
        const dictAddress = readUint24(buf, i)
        i += 3
        keySize = buf[dictAddress] - KEY_OPTS
        key = decoder.decode(
          buf.subarray(dictAddress + 1, keySize + dictAddress + 1),
        )
      } else if (keySize === 1) {
        const dictAddress = readUint16(buf, i)
        i += 2
        keySize = buf[dictAddress] - KEY_OPTS
        key = decoder.decode(
          buf.subarray(dictAddress + 1, keySize + dictAddress + 1),
        )
      } else if (keySize === 0) {
        const dictAddress = buf[i]
        i += 1
        keySize = buf[dictAddress] - KEY_OPTS
        key = decoder.decode(
          buf.subarray(dictAddress + 1, keySize + dictAddress + 1),
        )
      } else {
        keySize = keySize - KEY_OPTS
        key = decoder.decode(buf.subarray(i, keySize + i))
        i += keySize
      }
    }

    if (buf[i] === UINT8) {
      i += 1
      obj[key] = buf[i]
      i += 1
    } else if (buf[i] === FALSE) {
      i += 1
      obj[key] = false
    } else if (buf[i] === TRUE) {
      i += 1
      obj[key] = true
    } else if (buf[i] === FUNCTION) {
      i += 1
      const size = readUint16(buf, i)
      i += 2
      const fn = `return (${decoder.decode(buf.subarray(i, i + size))})(payload, prop)`
      obj[key] = new Function('payload', 'prop', fn)
      i += size
    } else if (buf[i] === STRING) {
      i += 1
      const size = readUint16(buf, i)
      i += 2
      obj[key] = decoder.decode(buf.subarray(i, i + size))
      i += size
    } else if (buf[i] === BINARY) {
      i += 1
      const size = readUint16(buf, i)
      i += 2
      obj[key] = buf.subarray(i, size + i)
      i += size
    } else if (buf[i] === UINT32) {
      obj[key] = readUint32(buf, i + 1)
      i += 5
    } else if (buf[i] === FLOAT64) {
      obj[key] = readDoubleLE(buf, i + 1)
      i += 9
    } else if (buf[i] === OBJECT || buf[i] === SCHEMA_PROP) {
      const nest = (obj[key] = {})
      const fieldSize = deSerializeInner(buf, nest, i, false)
      i += fieldSize
    } else if (buf[i] === ARRAY) {
      const len = readUint16(buf, i + 3)
      const nest = (obj[key] = new Array(len))
      const fieldSize = deSerializeInner(buf, nest, i, true)
      i += fieldSize
    } else {
      console.warn('Invalid value type', buf[i], 'skip')
      // Invalid value type
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
