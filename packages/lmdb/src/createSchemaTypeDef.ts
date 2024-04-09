import {
  BasedSchemaFieldObject,
  BasedSchemaFieldType,
  BasedSchemaType,
} from '@based/schema'
import { setByPath } from '@saulx/utils'
import { hashObjectIgnoreKeyOrder } from '@saulx/hash'
import { BasedDb } from './index.js'

const lenMap = {
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
  __sValue: true
  index: number
  type: BasedSchemaFieldType
  seperate: boolean
  path: string[]
  start: number
  len: number
  dbi?: number[]
}

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

let dbiIndex = 0

const createDbiHandle = (prefix: string, field: number, shard: number) => {
  const fieldAlphaNumeric = CHARS[field % 62]
  const shardAlphaNumeric =
    CHARS[shard % 62] + CHARS[Math.floor(shard / 62) % 62]

  //

  const dbi = prefix + fieldAlphaNumeric + shardAlphaNumeric + '\0'
  console.log(new Uint8Array(Buffer.from(dbi)))
  return Buffer.from(dbi)
}

export const getDbiHandler = (
  db: BasedDb,
  dbMap,
  shard: number,
  field: number,
): number => {
  if (field === 0) {
    if (!dbMap.dbi[shard]) {
      dbiIndex++
      const buffer = createDbiHandle(dbMap.prefix, field, shard)
      db.dbiIndex.set(dbiIndex, buffer)
      dbMap.dbi[shard] = dbiIndex
    }
    return dbMap.dbi[shard]
  }
  const f = dbMap.entries.get(field)
  if (!f.dbi[shard]) {
    dbiIndex++
    const buffer = createDbiHandle(dbMap.prefix, field, shard)
    db.dbiIndex.set(dbiIndex, buffer)
    f.dbi[shard] = dbiIndex
  }
  return f.dbi[shard]
}

export type SchemaFieldTree = { [key: string]: SchemaFieldTree | FieldDef }

export type SchemaTypeDef = {
  _cnt: number
  _checksum: number
  fields: {
    [key: string]: FieldDef
  }
  meta: {
    total: number
    lastId: number
  }
  dbMap: {
    dbi: number[]
    prefix: string
    entries: Map<number, any>
    _len: number
    tree: SchemaFieldTree
  }
}

export const createSchemaTypeDef = (
  type: BasedSchemaType | BasedSchemaFieldObject,
  result: any = {
    _cnt: 0,
    fields: {},
    meta: {
      total: 0,
      lastId: 0,
    },
    dbMap: {
      _len: 0,
      entries: new Map(),
      tree: {},
      dbi: [],
    },
    _checksum: hashObjectIgnoreKeyOrder(type),
  },
  path: string[] = [],
  top: boolean = true,
): SchemaTypeDef => {
  let target: any
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
      result.fields[p.join('.')] = {
        __sValue: true,
        type: f.type,
        path: p,
        len: lenMap[f.type],
      }
      result._cnt++
    }
  }

  if (top) {
    if (!('type' in type && 'properties' in type)) {
      result.dbMap.prefix = type.prefix ?? ''
    }

    const vals: any = Object.values(result.fields)

    vals.sort((a: any, b: any) => {
      if (!a.type) {
        return -1
      }
      return a.type === 'timestamp' || a.type === 'number' ? -1 : 1
    })

    let i = 1

    for (const f of vals) {
      f.index = i
      i++

      const len = f.len
      if (len) {
        if (!result.dbMap._) {
          result.dbMap._ = []
        }
        f.start = result.dbMap._len
        result.dbMap._len += len
        result.dbMap._.push(f)
        f.seperate = false
        setByPath(result.dbMap.tree, f.path, f)
      } else {
        setByPath(result.dbMap.tree, f.path, f)
        f.start = 0
        f.seperate = true
        f.dbi = []
        result.dbMap.entries.set(f.index, f)
      }
    }
  }

  return result
}
