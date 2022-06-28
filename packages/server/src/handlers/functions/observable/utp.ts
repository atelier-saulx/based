// @ts-nocheck
var DEFS = {
  VERSION: 1,
  TYPES: {
    BOOL: { bits: 8 },
    UINT8: { bits: 8 },
    INT8: { bits: 8, signed: true },
    UINT16: { bits: 16 },
    INT16: { bits: 16, signed: true },
    UINT32: { bits: 32 },
    INT32: { bits: 32, signed: true },
    INT64: { bits: 64 },
    FLOAT: { bits: 64, float: true },
    DATE: { bits: 64 },
    ENUM: { bits: 16 },
    BINARY: {},
    STRING: {},
    ARRAY: {},
    JSON: {},
    SCHEMA: {},
    PACKET: {},
  },
  SCHEMES_NAMES: [
    'PING',
    'PONG',
    'HELLO',
    'ERROR',
    'SCHEMA_ITEMS',
    'SCHEMA',
    'PROTO',
    'RPC',
  ],
  TYPES_NAMES: [],
  SCHEMES: [],
  INDEX: {},
  RPC: {},
  SIZE_SIZE: 4,
  HEADER_SIZE: 10,
  TEMP_NAME: '__TEMP_NAME__',
  MAX_UINT32: 4294967295,
  IS_LOCKED: true,
  compile: () => {
    DEFS.SCHEMES_NAMES.forEach((value, index) => (DEFS.INDEX[value] = index))
  },
}
for (let TYPE2 in DEFS.TYPES) {
  DEFS.TYPES_NAMES.push(TYPE2)
}
DEFS.compile()
DEFS.SCHEMES[DEFS.INDEX.PING] =
  DEFS.SCHEMES[DEFS.INDEX.PONG] =
  DEFS.SCHEMES[DEFS.INDEX.HELLO] =
    []
DEFS.SCHEMES[DEFS.INDEX.ERROR] = [
  { name: 'code', type: 'UINT16' },
  { name: 'text', type: 'STRING' },
]
DEFS.SCHEMES[DEFS.INDEX.SCHEMA_ITEMS] = [
  { name: 'type', type: 'ENUM', list: DEFS.TYPES_NAMES },
  { name: 'schema', type: 'STRING', optional: true },
  { name: 'items', type: 'SCHEMA', schema: 'SCHEMA_ITEMS', optional: true },
  { name: 'list', type: 'ARRAY', items: { type: 'STRING' }, optional: true },
]
DEFS.SCHEMES[DEFS.INDEX.SCHEMA] = [
  { name: 'name', type: 'STRING' },
  { name: 'type', type: 'ENUM', list: DEFS.TYPES_NAMES },
  { name: 'items', type: 'SCHEMA', schema: 'SCHEMA_ITEMS', optional: true },
  { name: 'schema', type: 'STRING', optional: true },
  { name: 'list', type: 'ARRAY', items: { type: 'STRING' }, optional: true },
  { name: 'maxlength', type: 'INT32', optional: true },
  { name: 'optional', type: 'BOOL', optional: true },
]
DEFS.SCHEMES[DEFS.INDEX.PROTO] = [
  { name: 'VERSION', type: 'UINT32' },
  { name: 'TYPES', type: 'JSON' },
  { name: 'SCHEMES_NAMES', type: 'ARRAY', items: { type: 'STRING' } },
  {
    name: 'SCHEMES',
    type: 'ARRAY',
    items: { type: 'ARRAY', items: { type: 'SCHEMA', schema: 'SCHEMA' } },
  },
  { name: 'RPC', type: 'JSON' },
]
DEFS.SCHEMES[DEFS.INDEX.RPC] = [
  { name: 'method', type: 'STRING' },
  { name: 'packet', type: 'PACKET', optional: true },
]
var defs_default = DEFS

// src/errors.js
var errors_default = {
  SCHEMA_NOT_FOUND: 1,
  INVALID_HEADER: 2,
  INVALID_INPUT_DATA: 3,
  INVALID_INPUT_DATA_TYPE: 4,
  INVALID_INPUT_DATA_VALUE: 5,
  INVALID_BINARY_DATA: 6,
  EMPTY_REQUIRED_FIELD: 7,
  PACK_ERROR: 8,
  UNPACK_ERROR: 9,
  INCORRECT_PACKET_SIZE: 10,
  INVALID_RPC_INPUT_DATA: 11,
}

// src/tools.js
var stringDecoder = new TextDecoder()
var stringEncoder = new TextEncoder()
function pack(value, options) {
  if (options.float) {
    if (![32, 64].includes(options.bits)) {
      throw new Error('Incorrect bits for value (float)')
    }
    let buffer = new ArrayBuffer(options.bits / 8)
    if (options.bits === 32) {
      new DataView(buffer).setFloat32(0, value)
      return buffer
    } else {
      new DataView(buffer).setFloat64(0, value)
      return buffer
    }
  } else {
    if (![8, 16, 32, 64].includes(options.bits)) {
      throw new Error('Incorrect bits for value (integer)')
    }
    let buffer = new ArrayBuffer(options.bits / 8)
    if (options.bits === 8) {
      if (options.signed) {
        new DataView(buffer).setInt8(0, value)
      } else {
        new DataView(buffer).setUint8(0, value)
      }
      return buffer
    }
    if (options.bits === 16) {
      if (options.signed) {
        new DataView(buffer).setInt16(0, value)
      } else {
        new DataView(buffer).setUint16(0, value)
      }
      return buffer
    }
    if (options.bits === 32) {
      if (options.signed) {
        new DataView(buffer).setInt32(0, value)
      } else {
        new DataView(buffer).setUint32(0, value)
      }
      return buffer
    }
    if (options.bits === 64) {
      new DataView(buffer).setFloat64(0, value)
      return buffer
    }
  }
  throw new Error('Incompatible options')
}
function unpack(buffer, options, offset = 0) {
  const view = new DataView(buffer, offset)
  if (options.float) {
    if (![32, 64].includes(options.bits)) {
      throw new Error('Incorrect bits for value (float)')
    }
    if (options.bits === 32) {
      return view.getFloat32()
    } else {
      return view.getFloat64()
    }
  } else {
    if (![8, 16, 32, 64].includes(options.bits)) {
      throw new Error('Incorrect bits for value (integer)')
    }
    if (options.bits === 8) {
      return options.signed ? view.getInt8() : view.getUint8()
    }
    if (options.bits === 16) {
      return options.signed ? view.getInt16() : view.getUint16()
    }
    if (options.bits === 32) {
      return options.signed ? view.getInt32() : view.getUint32()
    }
    if (options.bits === 64) {
      return parseInt(view.getFloat64(0))
    }
  }
  throw new Error('Incompatible options')
}
function packString(value) {
  try {
    return stringEncoder.encode(value).buffer
  } catch (err) {
    throw new Error(`packString error: ${err.message}`)
  }
}
function unpackString(buffer) {
  try {
    return stringDecoder.decode(buffer)
  } catch (err) {
    throw new Error(`unpackString error: ${err.message}`)
  }
}

// src/update.js
function update(protocol) {
  defs_default.VERSION = protocol.VERSION
  defs_default.TYPES = protocol.TYPES
  defs_default.SCHEMES_NAMES = protocol.SCHEMES_NAMES
  defs_default.SCHEMES = protocol.SCHEMES
  defs_default.RPC = protocol.RPC
  defs_default.compile()
}
function getVersion() {
  return defs_default.VERSION
}
function setVersion(version) {
  defs_default.VERSION = version
}
function addSchema(name, fields = []) {
  if (defs_default.SCHEMES_NAMES.indexOf(name) > -1) {
    throw new Error(
      `${errors_default.INVALID_INPUT_DATA_VALUE}: Schema "${name}" already in use`
    )
  }
  if (!Array.isArray(fields)) {
    throw new Error(
      `${errors_default.INVALID_INPUT_DATA_VALUE}: Fields is not array`
    )
  }
  const index = defs_default.SCHEMES_NAMES.length
  defs_default.SCHEMES_NAMES.push(name)
  defs_default.INDEX[name] = index
  defs_default.SCHEMES[index] = fields
  defs_default.compile()
  return defs_default.SCHEMES[defs_default.INDEX[name]]
}
function addSchemes(schemes) {
  for (let schema in schemes) {
    addSchema(schema, schemes[schema])
  }
}
function getDefinitions() {
  let result = {}
  defs_default.SCHEMES[defs_default.INDEX.PROTO].forEach((field) => {
    result = Object.assign(result, { [field.name]: defs_default[field.name] })
  })
  return result
}
function setLock(isLocked) {
  defs_default.IS_LOCKED = !!isLocked
}

// src/decode.js
function decode(data) {
  if (data === void 0 || typeof data !== 'object') {
    throw new ReferenceError(
      `${errors_default.INVALID_INPUT_DATA}: Data is missing or not object`
    )
  }
  if (data.byteLength === 4) {
    const buffer = new Uint8Array(data)
    const schemaIndex = unpack(buffer.buffer, defs_default.TYPES.UINT16)
    return {
      header: {
        schemaIndex,
        packetIndex: unpack(buffer.buffer, defs_default.TYPES.UINT16, 2),
        schemaName: defs_default.SCHEMES_NAMES[schemaIndex],
      },
    }
  }
  const header = decodeHeader(data)
  if (header.size !== data.length) {
    throw new Error(
      `${errors_default.INCORRECT_PACKET_SIZE}: Incorrect packet size ${data.length}, in header ${header.size}`
    )
  }
  if (defs_default.SCHEMES_NAMES[header.schemaIndex] === void 0) {
    throw new ReferenceError(
      `${errors_default.SCHEMA_NOT_FOUND}: Invalid schema index (${header.schemaIndex}) in header, schema not found`
    )
  }
  header.schemaName = defs_default.SCHEMES_NAMES[header.schemaIndex]
  const packet = { header }
  const decoded = decodeData(
    defs_default.SCHEMES[packet.header.schemaIndex],
    data
  )
  if (
    defs_default.SCHEMES_NAMES[header.schemaIndex] === 'PROTO' &&
    !defs_default.IS_LOCKED &&
    decoded.data.VERSION > defs_default.VERSION
  ) {
    update(decoded.data)
  }
  if (header.schemaName === 'RPC') {
    if (defs_default.RPC[decoded.data.method] !== decoded.data.packet.schema) {
      throw new Error(
        `${errors_default.INVALID_RPC_INPUT_DATA}: Incorrect schema for RPC method "${decoded.data.method}"`
      )
    }
    packet.header.method = decoded.data.method
    packet.data = decoded.data.packet.packet
  } else {
    packet.data = decoded.data
  }
  return packet
}
function decodeHeader(data) {
  if (data.length < defs_default.HEADER_SIZE) {
    return new ReferenceError(
      `${errors_default.INCORRECT_PACKET_SIZE}: Incorrect header size (${defs_default.HEADER_SIZE})`
    )
  }
  let view = new DataView(data.buffer)
  try {
    return {
      schemaIndex: view.getUint16(0),
      packetIndex: view.getUint16(2),
      version: view.getUint16(4),
      size: view.getUint32(6),
    }
  } catch (err) {
    return new ReferenceError(
      `${errors_default.INVALID_HEADER}: Invalid header`
    )
  }
}
function decodeData(schema, binaryData, start) {
  if (binaryData === void 0) {
    return [{}]
  }
  let result = {}
  let offset = start || defs_default.HEADER_SIZE
  let fieldData
  for (let i = 0; i < schema.length; i++) {
    fieldData = decodeDataField(schema[i], binaryData, offset)
    if (fieldData[0] !== void 0) {
      result[schema[i].name] = fieldData[0]
    }
    offset = fieldData[1]
  }
  return { data: result, offset }
}
function decodeDataField(field, binaryData, offset) {
  try {
    if (field.optional) {
      let unpacked = unpack(binaryData.buffer, defs_default.TYPES.INT8, offset)
      if (unpacked === 0) {
        offset += 1
        return [void 0, offset]
      }
      offset += 1
    }
    let result
    let size
    switch (field.type) {
      case 'BOOL':
      case 'UINT8':
      case 'UINT16':
      case 'UINT32':
      case 'INT8':
      case 'INT16':
      case 'INT32':
      case 'INT64':
      case 'DATE':
      case 'FLOAT':
      case 'ENUM':
        result = unpack(
          binaryData.buffer,
          defs_default.TYPES[field.type],
          offset
        )
        offset += parseInt(defs_default.TYPES[field.type].bits / 8)
        if (field.type === 'BOOL') {
          result = result !== 0
        }
        if (field.type === 'ENUM') {
          if (field.list[result] === void 0) {
            throw new ReferenceError(
              `${
                errors_default.INVALID_INPUT_DATA_VALUE
              }: Invalid ENUM value "${result}" for field "${
                field.name
              }", list: ${field.list.join(', ')}`
            )
          }
          result = field.list[result]
        }
        break
      case 'BINARY':
        size = unpack(binaryData.buffer, defs_default.TYPES.UINT32, offset)
        offset += defs_default.SIZE_SIZE
        result = Array.from(
          new Uint8Array(binaryData.subarray(offset, offset + size))
        )
        offset += size
        break
      case 'ARRAY':
        size = unpack(binaryData.buffer, defs_default.TYPES.UINT32, offset)
        offset += defs_default.SIZE_SIZE
        result = []
        let arrayItem
        for (let i = 0; i < size; i++) {
          if (
            field.items.type === 'ARRAY' &&
            field.items.items !== void 0 &&
            field.items.items.type !== void 0
          ) {
            let arraySize = unpack(
              binaryData.buffer,
              defs_default.TYPES.UINT32,
              offset
            )
            offset += defs_default.SIZE_SIZE
            let resultInArray = []
            for (let j = 0; j < arraySize; j++) {
              let fieldDefinition = {
                name: defs_default.TEMP_NAME,
                type: field.items.items.type,
              }
              defs_default.SCHEMES[defs_default.INDEX.SCHEMA].forEach((f) => {
                if (f.name !== 'name' && f.name !== 'type') {
                  if (field.items.items[f.name]) {
                    fieldDefinition[f.name] = field.items.items[f.name]
                  }
                }
              })
              arrayItem = decodeDataField(fieldDefinition, binaryData, offset)
              resultInArray.push(arrayItem[0])
              offset = arrayItem[1]
            }
            result.push(resultInArray)
          } else {
            let fieldDefinition = {
              name: defs_default.TEMP_NAME,
              type: field.items.type,
            }
            defs_default.SCHEMES[defs_default.INDEX.SCHEMA].forEach((f) => {
              if (f.name !== 'name' && f.name !== 'type') {
                if (field.items[f.name]) {
                  fieldDefinition[f.name] = field.items[f.name]
                }
              }
            })
            arrayItem = decodeDataField(fieldDefinition, binaryData, offset)
            result.push(arrayItem[0])
            offset = arrayItem[1]
          }
        }
        break
      case 'STRING':
      case 'JSON':
        size = unpack(binaryData.buffer, defs_default.TYPES.UINT32, offset)
        offset += defs_default.SIZE_SIZE
        result = unpackString(binaryData.subarray(offset, offset + size))
        offset += size
        if (field.type === 'JSON') {
          try {
            result = JSON.parse(result)
          } catch (err) {
            throw new ReferenceError(
              `${errors_default.INVALID_INPUT_DATA_VALUE}: Invalid JSON in field "${field.name}"`
            )
          }
        }
        break
      case 'SCHEMA':
      case 'PACKET':
        let schemaIndex = defs_default.INDEX[field.schema]
        if (field.type === 'PACKET') {
          schemaIndex = unpack(
            binaryData.buffer,
            defs_default.TYPES.UINT16,
            offset
          )
          offset += 2
        }
        if (defs_default.SCHEMES[schemaIndex] === void 0) {
          throw new ReferenceError(
            `${errors_default.SCHEMA_NOT_FOUND}: Invalid schemaIndex "${schemaIndex}", schema not found`
          )
        }
        const schemaName = defs_default.SCHEMES_NAMES[schemaIndex]
        let schemaData = decodeData(
          defs_default.SCHEMES[schemaIndex],
          binaryData,
          offset
        )
        if (field.type === 'PACKET') {
          result = {
            schema: schemaName,
            packet: schemaData.data,
          }
        } else {
          result = schemaData.data
        }
        offset = schemaData.offset
        break
      default:
        throw new ReferenceError(
          `${errors_default.INVALID_INPUT_DATA}: Undefinned field type "${field.type}"`
        )
    }
    return [result, offset]
  } catch (err) {
    throw new Error(
      `${errors_default.UNPACK_ERROR}: Field "${field.name}" decoding error ${err.message}`
    )
  }
}

// src/encode.js
var packetIndex = 0
function encode(schema = 'PROTO', data) {
  if (schema === 'PROTO') {
    data = data || defs_default
  }
  const schemaIndex = defs_default.SCHEMES_NAMES.indexOf(schema)
  if (schemaIndex < 0) {
    throw new ReferenceError(
      `${errors_default.SCHEMA_NOT_FOUND}: Schema "${schema}" not found`
    )
  }
  packetIndex++
  if (packetIndex > 55555) {
    packetIndex = 0
  }
  if (schemaIndex < 2) {
    if (
      schemaIndex === 1 &&
      (data === void 0 ||
        data.packetIndex === void 0 ||
        !Number.isInteger(data.packetIndex))
    ) {
      throw new ReferenceError(
        `${errors_default.EMPTY_REQUIRED_FIELD}: Field "packetIndex" must be filled (UINT16)`
      )
    }
    let packet2 = new ArrayBuffer(4)
    let view2 = new DataView(packet2)
    view2.setUint16(0, schemaIndex)
    view2.setUint16(2, schemaIndex === 0 ? packetIndex : data.packetIndex)
    return packet2
  }
  if (data === void 0) {
    data = {}
  }
  const encoded = encodeData(defs_default.SCHEMES[schemaIndex], data)
  let totalLength = 0
  for (let i = 0; i < encoded.length; i++) {
    totalLength += encoded[i].byteLength
  }
  let encodedData = new Uint8Array(totalLength)
  let offset = 0
  for (let i = 0; i < encoded.length; i++) {
    encodedData.set(new Uint8Array(encoded[i]), offset)
    offset += encoded[i].byteLength
  }
  const size = defs_default.HEADER_SIZE + encodedData.length
  const packet = new Uint8Array(size)
  packet.set(encodedData, defs_default.HEADER_SIZE)
  let view = new DataView(packet.buffer)
  view.setUint16(0, schemaIndex)
  view.setUint16(2, packetIndex)
  view.setUint16(4, defs_default.VERSION)
  view.setUint32(6, size)
  return packet
}
function encodeData(schema, data) {
  if (!Array.isArray(schema)) {
    throw new ReferenceError(
      `${errors_default.INVALID_INPUT_DATA}: Invalid schema data`
    )
  }
  let result = []
  for (let i = 0; i < schema.length; i++) {
    result = result.concat(encodeDataField(schema[i], data))
  }
  return result
}
function encodeDataField(field, data) {
  let result = []
  let str
  let size
  let filled
  let fieldData = data[field.name]
  if (fieldData === null || Number.isNaN(fieldData)) {
    fieldData = void 0
  }
  try {
    filled = fieldData !== void 0
    if (field.optional) {
      result = result.concat(pack(filled ? 1 : 0, defs_default.TYPES.INT8))
      if (fieldData === null) {
        return result
      }
    }
    if (filled) {
      switch (field.type) {
        case 'BOOL':
          if (typeof fieldData !== 'boolean') {
            throw new ReferenceError(
              `${errors_default.INVALID_INPUT_DATA_TYPE}: Invalid data type (${field.type})`
            )
          }
          result = result.concat(
            pack(fieldData === false ? 0 : 1, defs_default.TYPES.BOOL)
          )
          break
        case 'UINT8':
        case 'UINT16':
        case 'UINT32':
        case 'INT8':
        case 'INT16':
        case 'INT32':
        case 'INT64':
        case 'DATE':
          if (
            typeof fieldData !== 'number' ||
            !isFinite(fieldData) ||
            Math.floor(fieldData) !== fieldData
          ) {
            throw new ReferenceError(
              `${errors_default.INVALID_INPUT_DATA_TYPE}: Invalid data type "${field.type}" for field "${field.name}"`
            )
          }
          result = result.concat(
            pack(fieldData, defs_default.TYPES[field.type])
          )
          break
        case 'FLOAT':
          if (isNaN(fieldData)) {
            throw new ReferenceError(
              `${errors_default.INVALID_INPUT_DATA_TYPE}: Invalid data type "${field.type}" for field "${field.name}"`
            )
          }
          result = result.concat(
            pack(fieldData, defs_default.TYPES[field.type])
          )
          break
        case 'ENUM':
          if (
            field.list !== void 0 &&
            Array.isArray(field.list) &&
            field.list.indexOf(fieldData) > -1
          ) {
            result = result.concat(
              pack(field.list.indexOf(fieldData), defs_default.TYPES.UINT16)
            )
          } else {
            throw new ReferenceError(
              `${
                errors_default.INVALID_INPUT_DATA_VALUE
              }: Invalid ENUM value "${fieldData}" for field "${
                field.name
              }", list: ${field.list.join(', ')}`
            )
          }
          break
        case 'BINARY':
          if (typeof fieldData !== 'object') {
            throw new ReferenceError(
              `${errors_default.INVALID_INPUT_DATA_TYPE}: Invalid data type "${field.type}" for field "${field.name}"`
            )
          }
          if (fieldData.byteLength > defs_default.MAX_UINT32) {
            throw new ReferenceError(
              `${errors_default.INVALID_INPUT_DATA_VALUE}: Invalid data length, max ${defs_default.MAX_UINT32}`
            )
          }
          size = pack(fieldData.byteLength, defs_default.TYPES.UINT32)
          result = result.concat(size).concat(fieldData.buffer)
          break
        case 'ARRAY':
          if (
            field.items === void 0 ||
            field.items.type === void 0 ||
            fieldData === void 0 ||
            !Array.isArray(fieldData)
          ) {
            throw new ReferenceError(
              `${errors_default.INVALID_INPUT_DATA_TYPE}: Invalid data type "${field.type}" for field "${field.name}"`
            )
          }
          size = pack(fieldData.length, defs_default.TYPES.UINT32)
          result = result.concat(size)
          for (let i = 0; i < fieldData.length; i++) {
            if (field.items.type === 'ARRAY') {
              size = pack(fieldData[i].length, defs_default.TYPES.UINT32)
              result = result.concat(size)
              let fieldValue = {}
              for (let j = 0; j < fieldData[i].length; j++) {
                fieldValue[defs_default.TEMP_NAME] = fieldData[i][j]
                let fieldDefinition = {
                  name: defs_default.TEMP_NAME,
                  type: field.items.items.type,
                }
                defs_default.SCHEMES[defs_default.INDEX.SCHEMA].forEach((f) => {
                  if (f.name !== 'name' && f.name !== 'type') {
                    if (field.items.items[f.name]) {
                      fieldDefinition[f.name] = field.items.items[f.name]
                    }
                  }
                })
                result = result.concat(
                  encodeDataField(fieldDefinition, fieldValue)
                )
              }
            } else {
              let fieldValue = {}
              fieldValue[defs_default.TEMP_NAME] = fieldData[i]
              let fieldDefinition = {
                name: defs_default.TEMP_NAME,
                type: field.items.type,
              }
              defs_default.SCHEMES[defs_default.INDEX.SCHEMA].forEach((f) => {
                if (f.name !== 'name' && f.name !== 'type') {
                  if (field.items[f.name]) {
                    fieldDefinition[f.name] = field.items[f.name]
                  }
                }
              })
              result = result.concat(
                encodeDataField(fieldDefinition, fieldValue)
              )
            }
          }
          break
        case 'STRING':
        case 'JSON':
          if (
            (field.type === 'JSON' && typeof fieldData !== 'object') ||
            (field.type === 'STRING' && typeof fieldData !== 'string')
          ) {
            throw new ReferenceError(
              `${errors_default.INVALID_INPUT_DATA_TYPE}: Invalid data type (${field.type}) for field "${field.name}"`
            )
          }
          str = packString(
            field.type === 'JSON' ? JSON.stringify(fieldData) : fieldData
          )
          if (str.byteLength > defs_default.MAX_UINT32) {
            throw new ReferenceError(
              `${errors_default.INVALID_INPUT_DATA_VALUE}: Invalid data length, max ${defs_default.MAX_UINT32}`
            )
          }
          size = pack(str.byteLength, defs_default.TYPES.UINT32)
          result = result.concat(size).concat(str)
          break
        case 'SCHEMA':
        case 'PACKET':
          if (typeof fieldData !== 'object') {
            throw new ReferenceError(
              `${errors_default.INVALID_INPUT_DATA_TYPE}: Invalid data type (${field.type}) for field "${field.name}"`
            )
          }
          const schemaIndex =
            defs_default.INDEX[
              field.type === 'SCHEMA' ? field.schema : fieldData.schema
            ]
          if (schemaIndex === void 0) {
            throw new ReferenceError(
              `${errors_default.SCHEMA_NOT_FOUND}: Schema "${fieldData.schema}" not found`
            )
          }
          if (field.type === 'PACKET') {
            result = result.concat(pack(schemaIndex, defs_default.TYPES.UINT16))
          }
          const schemaData =
            field.type === 'SCHEMA' ? data[field.name] : fieldData.data
          result = result.concat(
            encodeData(defs_default.SCHEMES[schemaIndex], schemaData)
          )
          break
        default:
          throw new ReferenceError(
            `${errors_default.INVALID_INPUT_DATA}: Undefinned field type "${field.type}"`
          )
      }
    } else if (!field.optional) {
      throw new ReferenceError(
        `${errors_default.EMPTY_REQUIRED_FIELD}: Field "${field.name}" is required and must be filled`
      )
    }
  } catch (err) {
    throw new Error(
      `${errors_default.PACK_ERROR}: Field "${field.name}" encoding error ${err.message}`
    )
  }
  return result
}

// src/rpc.js
function registerRPC(method, schema) {
  if (defs_default.RPC[method] !== void 0) {
    throw new Error(
      `${errors_default.INVALID_INPUT_DATA_VALUE} RPC method "${method}" already in use`
    )
  }
  if (defs_default.INDEX[schema] === void 0) {
    throw new Error(
      `${errors_default.SCHEMA_NOT_FOUND} Schema "${schema}" not found`
    )
  }
  defs_default.RPC[method] = schema
}
function encodeRPC(method, data) {
  if (defs_default.RPC[method] === void 0) {
    throw new Error(
      `${errors_default.INVALID_INPUT_DATA_VALUE} RPC method "${method}" not found`
    )
  }
  return encode('RPC', {
    method,
    packet: {
      schema: defs_default.RPC[method],
      data,
    },
  })
}

// src/main.js
var TYPE = {
  BOOL: 'BOOL',
  UINT8: 'UINT8',
  INT8: 'INT8',
  UINT16: 'UINT16',
  INT16: 'INT16',
  UINT32: 'UINT32',
  INT32: 'INT32',
  INT64: 'INT64',
  FLOAT: 'FLOAT',
  DATE: 'DATE',
  ENUM: 'ENUM',
  BINARY: 'BINARY',
  STRING: 'STRING',
  ARRAY: 'ARRAY',
  JSON: 'JSON',
  SCHEMA: 'SCHEMA',
  PACKET: 'PACKET',
}
var main_default = {
  TYPE,
  encode,
  decode,
  addSchema,
  addSchemes,
  registerRPC,
  encodeRPC,
  setLock,
  setVersion,
  getVersion,
  getDefinitions,
}
export { main_default as default }
