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
  string: 0, // var length fixed length will be different
  references: 0,
}

const TYPE_INDEX: Map<BasedSchemaFieldType, number> = new Map()

let index = 0
for (const key in SIZE_MAP) {
  // @ts-ignore
  TYPE_INDEX.set(key, index)
  index++
}

/*
[58,62,0,1,1,1,2,2,3,4,68,90,0,1,1,48,90,2]
// make buffer
[“MYTYPE”,“flap”,”xx”,”bla.bla”,”bla.x”]
*/

export type FieldDef = {
  __isField: true
  field: number // (0-255 - 1) to start?
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
  lastId: number
  mainLen: number
  buf: Buffer
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

export const createSchemaTypeDef = (
  type: BasedSchemaType | BasedSchemaFieldObject,
  result: Partial<SchemaTypeDef> = {
    cnt: 0,
    checksum: hashObjectIgnoreKeyOrder(type),
    total: 0,
    lastId: 0,
    fields: {},
    prefix: prefixStringToUint8(type),
    mainLen: 0,
    prefixString: 'prefix' in type ? type.prefix : '',
    seperate: [],
    tree: {},
  },
  path: string[] = [],
  top: boolean = true,
): SchemaTypeDef => {
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
      createSchemaTypeDef(f, result, p, false)
    } else {
      const len = SIZE_MAP[f.type]
      const isSeperate = len === 0
      if (isSeperate) {
        result.cnt++
      }
      result.fields[p.join('.')] = {
        typeByte: TYPE_INDEX.get(f.type),
        __isField: true,
        type: f.type,
        seperate: isSeperate,
        path: p,
        start: 0,
        len,
        field: isSeperate ? result.cnt : 0,
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

    result.buf = Buffer.allocUnsafe(len)

    result.buf[0] = result.prefix[0]
    result.buf[1] = result.prefix[1]

    if (result.mainLen) {
      result.buf[2] = 0

      let i = 3
      for (const f of vals) {
        if (!f.seperate) {
          // bla
          result.buf[i] = f.typeByte
        }
      }
    }

    // make buffers as well
  }

  return result as SchemaTypeDef
}
