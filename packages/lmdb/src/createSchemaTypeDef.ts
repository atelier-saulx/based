import {
  BasedSchemaFieldObject,
  BasedSchemaFieldType,
  BasedSchemaType,
} from '@based/schema'
import { setByPath, wait } from '@saulx/utils'
import { compile, createRecord } from 'data-record'

const lenMap = {
  timestamp: 8, // 64bit
  // double-precision 64-bit binary format IEEE 754 value
  number: 8, // 64bit
  integer: 4, // 32bit Unisgned 4
  boolean: 1, // 1bit (bit overhead)
  string: 0,
}

export type FieldDef = {
  __sValue: true
  type: BasedSchemaFieldType
  path: string[]
  len: number
}

export type SchemaFieldTree = { [key: string]: SchemaFieldTree | FieldDef }

export type SchemaTypeDef = {
  _cnt: number
  fields: {
    [keyof: string]: FieldDef
  }
  dbMap: {
    _len: number
    tree: SchemaFieldTree
    dataRecordDef: { name: number | string; type: string }[]
    record: ReturnType<typeof compile>
  }
}

export const createSchemaTypeDef = (
  type: BasedSchemaType | BasedSchemaFieldObject,
  result: any = {
    _cnt: 0,
    fields: {},
    dbMap: {
      _len: 0,
      tree: {},
      dataRecordDef: [],
    },
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
    const vals: any = Object.values(result.fields)

    vals.sort((a: any, b: any) => {
      if (!a.type) {
        return -1
      }
      return a.type === 'timestamp' || a.type === 'number' ? -1 : 1
    })

    let i = 0
    for (const f of vals) {
      f.index = i
      i++

      // reference will be changed in schema

      result.dbMap.dataRecordDef.push({
        name: f.index,
        type:
          f.type === 'integer'
            ? 'uint32_le'
            : f.type === 'timestamp'
              ? 'double_le'
              : f.type === 'number'
                ? 'double_le'
                : f.type === 'boolean'
                  ? 'uint8'
                  : f.type === 'string'
                    ? 'cstring_p'
                    : '????',
      })

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
        result.dbMap[f.index] = f
      }
    }

    result.dbMap.record = compile(result.dbMap.dataRecordDef)

    console.log(result.dbMap.record)
    console.dir(Object.keys(result.dbMap), { depth: 10 })
    console.log(result.dbMap._.map((v) => v.path))
  }

  return result
}
