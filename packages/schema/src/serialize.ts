// import * as deflate from 'fflate'
import { StrictSchema, stringFormats } from './types.js'
import { ENUM, REVERSE_TYPE_INDEX_MAP, TYPE_INDEX_MAP } from './def/types.js'
import {
  readDoubleLE,
  readUint16,
  readUint24,
  readUint32,
  writeDoubleLE,
  writeUint16,
  writeUint24,
  writeUint32,
} from '@based/utils'

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

// Key Address encoding types
const KEY_ADDRESS_1_BYTE = 0
const KEY_ADDRESS_2_BYTES = 1
const KEY_ADDRESS_3_BYTES = 2

// Key types
const PROPS = 3
const TYPES = 4
const READONLY = 5
const FORMAT = 6
const REQUIRED = 7
const REF = 8
const PROP = 9

const KEY_OPTS = PROP

type DictMapUsed = { key: DictMapKey; address: number }

// used: DictMapUsed[]
type DictMapKey = { address: number; changed: number }

type DictMap = Record<string, DictMapKey>

type SchemaBuffer = {
  buf: Uint8Array
  len: number
  dictMap: DictMap
  dictMapArr: DictMapKey[]
  dictMapUsed: DictMapUsed[]
  keyChangeIndex: number
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
    // Support both arrow functions and methods (including shorthand method syntax)
    let str = val.toString()
    if (typeof val === 'function' && /^[a-zA-Z0-9_$]+\s*\(/.test(str)) {
      str = 'function ' + str
    }
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
        walk(ops, val, obj, prev, true, schemaBuffer)
      } else {
        walk(ops, val, obj, prev, fromObject, schemaBuffer)
      }
    }
  } else if (type === 'boolean') {
    ensureCapacity(1)
    schemaBuffer.buf[schemaBuffer.len] = val ? TRUE : FALSE
    schemaBuffer.len += 1
  } else if (type === 'string') {
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
    } else if (val < 4294967295 && val > 0 && isInt) {
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
  // deflate?: boolean
  readOnly?: boolean
  stripMetaInformation?: boolean
}

const encodeKey = (key: string, schemaBuffer: SchemaBuffer) => {
  let dictKey = schemaBuffer.dictMap[key]
  // if len == 1 never from address
  if (!dictKey) {
    dictKey = {
      changed: 0,
      address: 0,
      // used: [],
    }
    // pessimistically assume 4 bytes per char for UTF-8 to be safe.
    ensureCapacity(1 + key.length * 4)
    dictKey.address = schemaBuffer.len
    schemaBuffer.len += 1
    const r = ENCODER.encodeInto(
      key,
      schemaBuffer.buf.subarray(schemaBuffer.len),
    )
    schemaBuffer.buf[dictKey.address] = r.written + KEY_OPTS
    schemaBuffer.len += r.written
    // USED is the problem now
    schemaBuffer.dictMapArr.push(dictKey)
    schemaBuffer.dictMap[key] = dictKey
  } else {
    ensureCapacity(4)

    // updated address? maybe
    const dictMapUsed: DictMapUsed = { address: schemaBuffer.len, key: dictKey }
    schemaBuffer.dictMapUsed.push(dictMapUsed)
    // used can be handled differently - also pass to
    // dictKey.used.push(dictMapUsed)
    // console.log('USE KEY!', key)
    // have to check this to correct - correctly
    if (dictKey.address > 65025) {
      schemaBuffer.buf[schemaBuffer.len] = KEY_ADDRESS_3_BYTES
      schemaBuffer.len += 1
      writeUint24(schemaBuffer.buf, dictKey.address, schemaBuffer.len)
      schemaBuffer.len += 3
    } else if (dictKey.address > 255) {
      schemaBuffer.buf[schemaBuffer.len] = KEY_ADDRESS_2_BYTES
      schemaBuffer.len += 1
      writeUint16(schemaBuffer.buf, dictKey.address, schemaBuffer.len)
      schemaBuffer.len += 2
    } else {
      schemaBuffer.buf[schemaBuffer.len] = KEY_ADDRESS_1_BYTE
      schemaBuffer.len += 1
      schemaBuffer.buf[schemaBuffer.len] = dictKey.address
      schemaBuffer.len += 1
    }
  }
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
) => {
  let start = schemaBuffer.len

  const isArray = Array.isArray(obj)
  const isFromObj = prev2?.type === 'object' || fromObject === false
  const isSchemaProp =
    ('enum' in obj || ('type' in obj && TYPE_INDEX_MAP[obj.type])) && isFromObj

  ensureCapacity(1 + 5) // Type byte + size
  if (isSchemaProp) {
    schemaBuffer.buf[schemaBuffer.len++] = SCHEMA_PROP
    const typeIndex = TYPE_INDEX_MAP['enum' in obj ? 'enum' : obj.type]
    schemaBuffer.buf[schemaBuffer.len++] = typeIndex
  } else {
    schemaBuffer.buf[schemaBuffer.len++] = isArray ? ARRAY : OBJECT
  }
  let sizeIndex = schemaBuffer.len
  schemaBuffer.len += 4

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
        schemaBuffer.buf[schemaBuffer.len] = REQUIRED
        schemaBuffer.len += 1
        continue
      }
      // Add this later
      else if (key == 'ref' && isFromObj && typeof obj.ref === 'string') {
        ensureCapacity(1)
        schemaBuffer.buf[schemaBuffer.len] = REF
        schemaBuffer.len += 1
        encodeKey(obj[key], schemaBuffer)
        continue
      } else if (key === 'prop' && isFromObj && typeof obj.prop === 'string') {
        ensureCapacity(1)
        schemaBuffer.buf[schemaBuffer.len] = PROP
        schemaBuffer.len += 1
        encodeKey(obj[key], schemaBuffer)
        continue
      } else if (key === 'readOnly' && obj[key] === true) {
        ensureCapacity(1)
        schemaBuffer.buf[schemaBuffer.len] = READONLY
        schemaBuffer.len += 1
        continue
      } else if (key === 'format' && isFromObj) {
        ensureCapacity(2)
        schemaBuffer.buf[schemaBuffer.len] = FORMAT
        schemaBuffer.len += 1
        schemaBuffer.buf[schemaBuffer.len] = stringFormats.indexOf(obj.format)
        schemaBuffer.len += 1
        continue
      } else {
        if (key === 'types') {
          ensureCapacity(1)
          schemaBuffer.buf[schemaBuffer.len] = TYPES
          schemaBuffer.len += 1
        } else if (key === 'props') {
          ensureCapacity(1)
          schemaBuffer.buf[schemaBuffer.len] = PROPS
          schemaBuffer.len += 1
        } else {
          encodeKey(key, schemaBuffer)
        }
        // important to handle the size here...
        handleSingleValue(opts, obj[key], obj, prev, fromObject, key)
      }
    }
  }

  let size = schemaBuffer.len - start

  // 3 different sizes? 3, 2, 1 ?
  if (size < 252) {
    schemaBuffer.keyChangeIndex++
    schemaBuffer.buf[sizeIndex] = size // + 3 - 3
    for (let i = schemaBuffer.dictMapArr.length - 1; i > -1; i--) {
      const keyDict = schemaBuffer.dictMapArr[i]
      if (keyDict.address < start) {
        break
      } else {
        keyDict.changed = schemaBuffer.keyChangeIndex
        keyDict.address -= 3
      }
    }

    for (let i = schemaBuffer.dictMapUsed.length - 1; i > -1; i--) {
      const keyDictUsed = schemaBuffer.dictMapUsed[i]
      if (keyDictUsed.address < start) {
        break
      } else {
        const keyDict = keyDictUsed.key
        if (keyDict.changed === schemaBuffer.keyChangeIndex) {
          const addressSize = schemaBuffer.buf[keyDictUsed.address]
          //  aslo correct if its smaller...  :|
          if (addressSize === KEY_ADDRESS_3_BYTES) {
            writeUint24(
              schemaBuffer.buf,
              keyDict.address,
              keyDictUsed.address + 1,
            )
          } else if (addressSize === KEY_ADDRESS_2_BYTES) {
            writeUint16(
              schemaBuffer.buf,
              keyDict.address,
              keyDictUsed.address + 1,
            )
          } else if (addressSize === KEY_ADDRESS_1_BYTE) {
            schemaBuffer.buf[keyDictUsed.address + 1] = keyDict.address
          }
        }
        keyDictUsed.address -= 3
      }
    }
    schemaBuffer.buf.copyWithin(sizeIndex + 1, sizeIndex + 4, sizeIndex + size)
    schemaBuffer.len -= 3
  } else {
    schemaBuffer.buf[sizeIndex] = 0 // means 4
    writeUint24(schemaBuffer.buf, size, sizeIndex + 1)
  }
}

export const serialize = (schema: any, opts: Opts = {}): Uint8Array => {
  if (!schemaBuffer) {
    schemaBuffer = {
      buf: new Uint8Array(5e3), // 5kb default
      len: 0,
      dictMap: {},
      dictMapArr: [],
      dictMapUsed: [],
      keyChangeIndex: 0,
    }
  }
  schemaBuffer.keyChangeIndex = 0
  schemaBuffer.len = 0
  schemaBuffer.dictMap = {}
  schemaBuffer.dictMapArr = []
  schemaBuffer.dictMapUsed = []

  // defalte not supported in unpacking yet
  const isDeflate = 0 // opts.deflate ? 1 : 0
  walk(opts, schema, undefined, undefined, false, schemaBuffer)
  const packed = new Uint8Array(schemaBuffer.buf.subarray(0, schemaBuffer.len))

  // if (isDeflate) {
  //   // add extra byte! see if nessecary
  //   return deflate.deflateSync(packed)
  // } else {

  // console.log('USED', schemaBuffer.dictMapUsed.length)
  return packed
  // }
}

// -------------
const decoder = new TextDecoder()

export const deSerializeKey = (buf: Uint8Array, keySize: number, i: number) => {
  let size = 0
  let value: string
  if (keySize === KEY_ADDRESS_3_BYTES) {
    const dictAddress = readUint24(buf, i)
    size += 3
    const actualKeySize = buf[dictAddress] - KEY_OPTS
    value = decoder.decode(
      buf.subarray(dictAddress + 1, actualKeySize + dictAddress + 1),
    )
  } else if (keySize === KEY_ADDRESS_2_BYTES) {
    const dictAddress = readUint16(buf, i)
    size += 2
    const actualKeySize = buf[dictAddress] - KEY_OPTS
    value = decoder.decode(
      buf.subarray(dictAddress + 1, actualKeySize + dictAddress + 1),
    )
  } else if (keySize === KEY_ADDRESS_1_BYTE) {
    const dictAddress = buf[i]
    size += 1
    const actualKeySize = buf[dictAddress] - KEY_OPTS
    value = decoder.decode(
      buf.subarray(dictAddress + 1, actualKeySize + dictAddress + 1),
    )
  } else {
    const actualKeySize = keySize - KEY_OPTS
    value = decoder.decode(buf.subarray(i, actualKeySize + i))
    size += actualKeySize
  }
  return { size, value }
}

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
    if (type !== ENUM) {
      obj.type = parsedType
    }
    i += 1
  }

  let size: number
  if (buf[i] === 0) {
    size = readUint24(buf, i + 1)
    i += 4
  } else {
    size = buf[i] - 3
    i += 1
  }

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
      if (keySize === REQUIRED) {
        obj.required = true
        continue
      } else if (keySize === FORMAT) {
        obj.format = stringFormats[buf[i]]
        i += 1
        continue
      } else if (keySize === READONLY) {
        obj.readOnly = true
        continue
      } else if (keySize === TYPES) {
        key = 'types'
      } else if (keySize === PROPS) {
        key = 'props'
      } else if (keySize === REF) {
        const valueKeySize = buf[i]
        i += 1
        const { size, value } = deSerializeKey(buf, valueKeySize, i)
        i += size
        obj.ref = value
        continue
      } else if (keySize === PROP) {
        const valueKeySize = buf[i]
        i += 1
        const { size, value } = deSerializeKey(buf, valueKeySize, i)
        i += size
        obj.prop = value
        continue
      } else {
        const { size, value } = deSerializeKey(buf, keySize, i)
        i += size
        key = value
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
