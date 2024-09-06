import {
  BasedSchemaField,
  BasedSchemaFieldObject,
  BasedSchemaFieldType,
  BasedSchemaType,
} from '@based/schema'
import { setByPath } from '@saulx/utils'
import { hashObjectIgnoreKeyOrder } from '@saulx/hash'
import { BasedNode } from './basedNode/index.js'
import { BasedDb } from './index.js'

const SIZE_MAP: Partial<Record<BasedSchemaFieldType, number>> = {
  timestamp: 8, // 64bit
  // double-precision 64-bit binary format IEEE 754 value
  number: 8, // 64bit
  integer: 4, // 32bit Unisgned 4  16bit
  boolean: 1, // 1bit (6 bits overhead)
  reference: 0, // seperate
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
  selvaField: number
  inverseField?: string
  allowedType?: string
  type: BasedSchemaFieldType | 'id'
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
  prefixNumber: number
  prefix: Uint8Array
  seperate: FieldDef[]
  tree: SchemaFieldTree
  hasStringField: boolean
  stringFieldsSize: number
  stringFields: Buffer // size will be max field
  stringFieldsCurrent: Buffer // size will be max field
  stringFieldsLoop: FieldDef[]
  responseCtx: BasedNode
  // HELLO
}

const prefixStringToUint8 = (
  type: BasedSchemaType | BasedSchemaFieldObject,
): Uint8Array => {
  if (!('type' in type && 'properties' in type)) {
    return new Uint8Array([
      type.prefix.charCodeAt(0),
      type.prefix.charCodeAt(1),
    ])
  }
  return new Uint8Array([0, 0])
}

export const isFieldDef = (
  tree: SchemaFieldTree | FieldDef,
): tree is FieldDef => {
  if ('__isField' in tree && tree.__isField === true) {
    return true
  }
  return false
}

export const createSchemaTypeDef = (
  typeName: string,
  type: BasedSchemaType | BasedSchemaFieldObject,
  parsed: BasedDb['schemaTypesParsed'],
  result: Partial<SchemaTypeDef> = {
    cnt: 0,
    checksum: hashObjectIgnoreKeyOrder(type),
    type: typeName,
    fields: {},
    prefix: prefixStringToUint8(type),
    prefixNumber: 0,
    mainLen: 0,
    seperate: [],
    // stringFieldsBuffer
    tree: {},
    // temporary
    total: 0,
    // also temprorary
    lastId: 0,
    stringFieldsSize: 0,
    stringFieldsLoop: [],
  },
  path: string[] = [],
  top: boolean = true,
): SchemaTypeDef => {
  if (result.prefixNumber == 0) {
    result.prefixNumber = (result.prefix[1] << 8) + result.prefix[0]

    console.info('TYPE PREFIX: ', typeName, result.prefixNumber)
  }

  const encoder = new TextEncoder()

  let target: { [key: string]: BasedSchemaField }
  let stringFields: number = 0

  if ('type' in type && 'properties' in type) {
    target = type.properties
  } else {
    target = type.fields
  }

  for (const key in target) {
    const f = target[key]
    const p = [...path, key]
    if (f.type === 'object') {
      createSchemaTypeDef(typeName, f, parsed, result, p, false)
    } else {
      let len = SIZE_MAP[f.type]

      if (f.type === 'string') {
        // @ts-ignore
        if (f.maxBytes < 60) {
          // @ts-ignore
          len = f.maxBytes + 1
        } else if (f.maxLength < 30) {
          len = f.maxLength * 2 + 1
        } else {
          stringFields++
        }
      }

      const isSeperate = len === 0

      if (isSeperate) {
        result.cnt++
      }

      const field: FieldDef = {
        typeByte: TYPE_INDEX.get(f.type),
        __isField: true,
        type: f.type,
        seperate: isSeperate,
        path: p,
        start: 0,
        len,
        field: isSeperate ? result.cnt : 0,
        selvaField: 0, // will be set later
        inverseField:
          (f.type === 'reference' || f.type === 'references') &&
          f.inverseProperty,
        allowedType:
          (f.type === 'reference' || f.type === 'references') && f.allowedType,
      }

      result.fields[p.join('.')] = field
      if (isSeperate) {
        result.seperate.push(field)
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

    const mainFields: FieldDef[] = []
    const restFields: FieldDef[] = []

    for (const f of vals) {
      if (f.seperate) {
        restFields.push(f)
      } else {
        mainFields.push(f)
      }
    }
    let selvaField = 0
    for (const field of mainFields) {
      field.selvaField = selvaField++
    }
    for (const field of restFields) {
      field.selvaField = selvaField++
    }

    /*
      Add FIXED LEN STRING in main
    
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

    result.responseCtx = new BasedNode(result as SchemaTypeDef, parsed)

    if (stringFields > 0) {
      result.hasStringField = true
      let max = 0
      for (const f of result.seperate) {
        if (f.type === 'string') {
          if (f.field > max) {
            max = f.field
          }
        }
      }
      result.stringFields = Buffer.allocUnsafe(max + 1)
      for (const f of result.seperate) {
        if (f.type === 'string') {
          result.stringFields[f.field] = 1
          result.stringFieldsLoop.push(f)
          result.stringFieldsSize++
        }
      }
      result.stringFieldsCurrent = Buffer.allocUnsafe(max + 1)
      result.stringFields.copy(result.stringFieldsCurrent)
    }
  }

  return result as SchemaTypeDef
}

// TODO add enum in fields names!!!
export const readSchemaTypeDefFromBuffer = (
  buf: Buffer,
  fieldNames: Buffer,
  parsed: BasedDb['schemaTypesParsed'], // others...
): SchemaTypeDef => {
  const tree: SchemaFieldTree = {}
  const fields: {
    [key: string]: FieldDef
  } = {}
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
        selvaField: selvaField++,
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
        selvaField: selvaField++,
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

  // @ts-ignore
  const schemaTypeDef: SchemaTypeDef = {
    prefix: new Uint8Array([buf[0], buf[1]]),
    tree,
    fields,
    seperate,
    cnt,
    buf,
    type,
    fieldNames,
    checksum: 0,
    mainLen,
    total: 0,
    lastId: 0,
  }

  schemaTypeDef.responseCtx = new BasedNode(schemaTypeDef, parsed)

  return schemaTypeDef
}

export const idFieldDef: FieldDef = {
  type: 'id',
  typeByte: 0,
  seperate: true,
  path: ['id'],
  start: 0,
  field: 0,
  selvaField: 0,
  len: 4,
  __isField: true,
}

// TODO unify this
export function schema2selva(schema: { [key: string]: SchemaTypeDef }) {
  const typeNames = Object.keys(schema)
  const types = Object.values(schema)

  return types.map((t, i) => {
    const vals = Object.values(t.fields)
    const restFields: FieldDef[] = []

    for (const f of vals) {
      if (f.seperate) {
        restFields.push(f)
      }
    }

    // console.log(restFields)

    // TODO GET RID OF SELVAFIELD

    restFields.sort((a, b) => a.selvaField - b.selvaField)

    restFields.forEach((a) => {
      if (a.selvaField !== a.field) {
        throw new Error('SELVA FIELD HAS TO MATCH FIELD')
      }
    })

    // TODO Remove this once the types agree
    const typeMap = {
      timestamp: 1,
      created: 2,
      updated: 3,
      number: 4,
      integer: 5,
      boolean: 9,
      reference: 13,
      enum: 10,
      string: 11,
      references: 14,
      muffer: 17,
    }

    // add MUFFER (main buffer)

    // CLEAN THIS UP
    const toSelvaSchemaBuf = (f: FieldDef): number[] => {
      // @ts-ignore
      if (f.len && f.type == 'muffer') {
        // max size is
        const buf = Buffer.allocUnsafe(3)
        buf[0] = typeMap[f.type]
        buf.writeUint16LE(f.len, 1)
        return [...buf.values()]
      } else if (f.type === 'reference' || f.type === 'references') {
        const dstType: SchemaTypeDef = schema[f.allowedType]
        const buf = Buffer.allocUnsafe(4)
        // inverseField
        buf.writeUInt8(typeMap[f.type], 0)

        console.log(dstType)

        buf.writeUInt8(dstType.fields[f.inverseField].selvaField, 1)
        buf.writeUInt16LE(typeNames.indexOf(f.allowedType), 2)
        return [...buf.values()]
      } else if (f.type === 'string') {
        return [typeMap[f.type], f.len < 50 ? f.len : 0]
      } else {
        return [typeMap[f.type]]
      }
    }

    if (t.mainLen === 0) {
      const x = Buffer.from([
        1,
        ...toSelvaSchemaBuf({
          // this can be removed...

          // @ts-ignore
          type: 'muffer',
          len: 1,
        }),
        ...restFields.map((f) => toSelvaSchemaBuf(f)).flat(1),
      ])
      return x
    }

    const x = Buffer.from([
      1,
      ...toSelvaSchemaBuf({
        // @ts-ignore
        type: 'muffer',
        len: t.mainLen,
      }),
      ...restFields.map((f) => toSelvaSchemaBuf(f)).flat(1),
    ])

    return x
  })
}
