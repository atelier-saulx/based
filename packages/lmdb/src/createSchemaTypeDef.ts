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

export type FieldDef = {
  __isField: true
  field: number // (0-255 - 1) to start?
  type: BasedSchemaFieldType
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
  result: SchemaTypeDef = {
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
    for (const f of vals) {
      if (f.seperate) {
        setByPath(result.tree, f.path, f)
      } else {
        f.start = result.mainLen
        result.mainLen += f.len
        setByPath(result.tree, f.path, f)
      }
    }

    // make buffers as well
  }

  return result
}
