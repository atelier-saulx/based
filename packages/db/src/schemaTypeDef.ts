import {
  BasedSchemaField,
  BasedSchemaFieldObject,
  BasedSchemaFieldType,
  BasedSchemaType,
} from '@based/schema'
import { setByPath } from '@saulx/utils'
import { hashObjectIgnoreKeyOrder } from '@saulx/hash'

const SIZE_MAP: Partial<Record<BasedSchemaFieldType, number>> = {
  timestamp: 8, // 64bit
  // double-precision 64-bit binary format IEEE 754 value
  number: 8, // 64bit
  integer: 4, // 32bit Unisgned 4  16bit
  boolean: 1, // 1bit (6 bits overhead)
  reference: 4,
  enum: 4, // enum
  string: 0, // var length fixed length will be different
  references: 0,
}
const TYPE_INDEX: Map<BasedSchemaFieldType, number> = new Map([
  ['timestamp', 1],
  ['created', 2],
  ['updated', 3],
  ['number', 4],
  ['integer', 5],
  ['boolean', 6],
  ['reference', 7],
  ['enum', 8],
  ['string', 9],
  ['references', 10],
])
const REVERSE_TYPE_INDEX: Map<number, BasedSchemaFieldType> = new Map([
  [1, 'timestamp'],
  [2, 'created'],
  [3, 'updated'],
  [4, 'number'],
  [5, 'integer'],
  [6, 'boolean'],
  [7, 'reference'],
  [8, 'enum'],
  [9, 'string'],
  [10, 'references'],
])

export type FieldDef = {
  __isField: true
  field: number // (0-255 - 1) to start?
  selvaField: string
  type: BasedSchemaFieldType
  typeByte: number
  seperate: boolean
  path: string[]
  start: number
  len: number
}

export type SchemaFieldTree = { [key: string]: SchemaFieldTree | FieldDef }

export type SchemaTypeDef = {
  cnt: number
  checksum: number
  total: number
  type: string
  lastId: number
  mainLen: number
  buf: Buffer
  fieldNames: Buffer
  fields: {
    // path including .
    [key: string]: FieldDef
  }
  prefixString: string
  prefix: Uint8Array
  seperate: FieldDef[]
  tree: SchemaFieldTree
}

const prefixStringToUint8 = (
  type: BasedSchemaType | BasedSchemaFieldObject
): Uint8Array => {
  if (!('type' in type && 'properties' in type)) {
    return new Uint8Array([
      type.prefix.charCodeAt(0),
      type.prefix.charCodeAt(1),
    ])
  }
  return new Uint8Array([0, 0])
}

export const createSchemaTypeDef = (
  typeName: string,
  type: BasedSchemaType | BasedSchemaFieldObject,
  result: Partial<SchemaTypeDef> = {
    cnt: 0,
    checksum: hashObjectIgnoreKeyOrder(type),
    type: typeName,
    fields: {},
    prefix: prefixStringToUint8(type),
    mainLen: 0,
    prefixString: 'prefix' in type ? type.prefix : '',
    seperate: [],
    tree: {},

    // temporary
    total: 0,
    // also temprorary
    lastId: 0,
  },
  path: string[] = [],
  top: boolean = true
): SchemaTypeDef => {
  const encoder = new TextEncoder()

  let target: { [key: string]: BasedSchemaField }

  if ('type' in type && 'properties' in type) {
    target = type.properties
  } else {
    target = type.fields
  }

  for (const key in target) {
    const f = target[key]
    const p = [...path, key]
    if (f.type === 'object') {
      createSchemaTypeDef(typeName, f, result, p, false)
    } else {
      const len = SIZE_MAP[f.type]
      const isSeperate = len === 0
      if (isSeperate) {
        result.cnt++
      }
      const selvaField = Object.keys(result.fields).length
      result.fields[p.join('.')] = {
        typeByte: TYPE_INDEX.get(f.type),
        __isField: true,
        type: f.type,
        seperate: isSeperate,
        path: p,
        start: 0,
        len,
        field: isSeperate ? result.cnt : 0,
        selvaField: '' + selvaField,
      }
    }
  }

  if (top) {
    const vals = Object.values(result.fields)

    // PREFIX [2] | 0 = main ,
    let len = 2

    for (const f of vals) {
      if (f.seperate) {
        len += 2
        setByPath(result.tree, f.path, f)
      } else {
        if (!result.mainLen) {
          len += 2
        }
        len += 1
        f.start = result.mainLen
        result.mainLen += f.len
        setByPath(result.tree, f.path, f)
      }
    }

    /*
      [58,62,0,1,1,1,2,2,3,4,68,90,0,1,1,48,90,2]
      // [type, type][field if 0 means main][if main fieldType]...[if 0 ends main][fieldName 1][fieldType]...
      // make buffer
      [“MYTYPE”,“flap”,”xx”,”bla.bla”,”bla.x”]
    */
    result.buf = Buffer.allocUnsafe(len)
    result.buf[0] = result.prefix[0]
    result.buf[1] = result.prefix[1]

    const fieldNames = []
    const tNameBuf = encoder.encode(typeName)
    fieldNames.push(tNameBuf)

    let fieldNameLen = tNameBuf.byteLength + 1
    let i = 2
    if (result.mainLen) {
      result.buf[i] = 0
      for (const f of vals) {
        if (!f.seperate) {
          i++
          result.buf[i] = f.typeByte
          const name = encoder.encode(f.path.join('.'))
          fieldNames.push(name)
          fieldNameLen += name.byteLength + 1
        }
      }
      i++
      result.buf[i] = 0
    }
    for (const f of vals) {
      if (f.seperate) {
        i++
        result.buf[i] = f.field
        i++
        result.buf[i] = f.typeByte
        const name = encoder.encode(f.path.join('.'))
        fieldNames.push(name)
        fieldNameLen += name.byteLength + 1
      }
    }

    result.fieldNames = Buffer.allocUnsafe(fieldNameLen)
    let lastWritten = 0
    for (const f of fieldNames) {
      result.fieldNames[lastWritten] = f.byteLength
      result.fieldNames.set(f, lastWritten + 1)
      lastWritten += f.byteLength + 1
    }
  }

  return result as SchemaTypeDef
}

// TODO add enum in fields names!!!
export const readSchemaTypeDefFromBuffer = (
  buf: Buffer,
  fieldNames: Buffer
): SchemaTypeDef => {
  const tree: SchemaFieldTree = {}
  const fields: {
    [key: string]: FieldDef
  } = {}
  const prefix = String.fromCharCode(buf[0]) + String.fromCharCode(buf[1])
  const names: string[] = []
  const seperate: FieldDef[] = []
  let i = 0
  const decoder = new TextDecoder()
  while (i < fieldNames.byteLength) {
    const len = fieldNames[i]
    names.push(decoder.decode(fieldNames.slice(i + 1, i + len + 1)))
    i += len + 1
  }
  let j = 2
  let isMain = false
  if (buf[j] === 0) {
    isMain = true
    j++
  }
  const type = names[0]
  let currentName = 1
  let cnt = 0
  let mainLen = 0
  let selvaField = 0
  while (j < buf.byteLength) {
    if (isMain) {
      const typeByte = buf[j]
      if (typeByte === 0) {
        isMain = false
        j++
        continue
      }
      const typeName = REVERSE_TYPE_INDEX.get(typeByte)
      const name = names[currentName]
      const path = name.split('.')
      const len = SIZE_MAP[typeName]
      const field: FieldDef = {
        __isField: true,
        field: 0,
        selvaField: '' + selvaField++,
        type: typeName,
        typeByte,
        seperate: false,
        path,
        start: mainLen,
        len,
      }
      fields[name] = field
      setByPath(tree, path, field)
      mainLen += len
      currentName++

      j++
    } else {
      const fieldIndex = buf[j]
      const typeByte = buf[j + 1]
      const typeName = REVERSE_TYPE_INDEX.get(typeByte)
      const name = names[currentName]
      const path = name.split('.')
      const len = SIZE_MAP[typeName]
      const field: FieldDef = {
        __isField: true,
        field: fieldIndex,
        selvaField: '' + selvaField++,
        type: typeName,
        typeByte,
        seperate: false,
        path,
        start: mainLen,
        len,
      }
      fields[name] = field
      seperate.push(field)
      setByPath(tree, path, field)
      currentName++
      cnt++
      j += 2
    }
  }

  return {
    prefix: new Uint8Array([buf[0], buf[1]]),
    prefixString: prefix,
    tree,
    fields,
    seperate,
    cnt,
    buf,
    type,
    fieldNames,
    // TODO this is still incorrect
    checksum: 0,
    mainLen,
    // this is tmp has to be removed
    total: 0,
    lastId: 0,
  }
}
