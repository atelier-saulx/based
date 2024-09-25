import {
  isPropType,
  SchemaObject,
  SchemaType,
  getPropType,
} from '@based/schema'
import { setByPath } from '@saulx/utils'
import { hashObjectIgnoreKeyOrder } from '@saulx/hash'
import { BasedNode } from '../basedNode/index.js'
import { BasedDb } from '../index.js'
import {
  PropDef,
  SchemaTypeDef,
  SIZE_MAP,
  TYPE_INDEX_MAP,
  isType,
} from './types.js'

export const createSchemaTypeDef = (
  typeName: string,
  type: SchemaType | SchemaObject,
  parsed: BasedDb['schemaTypesParsed'],
  result: Partial<SchemaTypeDef> = {
    cnt: 0,
    checksum: hashObjectIgnoreKeyOrder(type),
    type: typeName,
    props: {},
    idUint8: new Uint8Array([0, 0]),
    id: 0,
    mainLen: 0,
    seperate: [],
    tree: {},
    // TODO will go to specific manager hub
    total: 0,
    lastId: 0,
    stringPropsSize: 0,
    stringPropsLoop: [],
  },
  path: string[] = [],
  top: boolean = true,
): SchemaTypeDef => {
  if (result.id == 0 && top) {
    if ('id' in type) {
      result.id = type.id
    } else {
      throw new Error(`Invalid schema type id ${result.type}`)
    }
  }

  result.idUint8[0] = result.id & 255
  result.idUint8[1] = result.id >> 8

  const encoder = new TextEncoder()
  const target = type.props
  let stringFields: number = 0

  for (const key in target) {
    const f = target[key]
    const p = [...path, key]
    const propType = getPropType(f)
    if (propType === 'object') {
      createSchemaTypeDef(typeName, f as SchemaObject, parsed, result, p, false)
    } else {
      let len = SIZE_MAP[propType]

      if (isPropType('string', f)) {
        if (typeof f === 'object') {
          if (f.maxBytes < 60) {
            len = f.maxBytes + 1
          } else if (f.max < 30) {
            len = f.max * 2 + 1
          } else {
            stringFields++
          }
        } else {
          stringFields++
        }
      }

      const isSeperate = len === 0

      if (isSeperate) {
        result.cnt++
      }

      const prop: PropDef = {
        typeIndex: TYPE_INDEX_MAP[propType],
        __isPropDef: true,
        seperate: isSeperate,
        path: p,
        start: 0,
        len,
        prop: isSeperate ? result.cnt : 0,
      }

      if (isPropType('references', f)) {
        prop.inversePropName = f.items.prop
        prop.inverseTypeName = f.items.ref
      } else if (isPropType('reference', f)) {
        prop.inversePropName = f.prop
        prop.inverseTypeName = f.ref
      }

      result.props[p.join('.')] = prop
      if (isSeperate) {
        result.seperate.push(prop)
      }
    }
  }

  if (top) {
    const vals = Object.values(result.props)
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

    const mainFields: PropDef[] = []
    const restFields: PropDef[] = []

    for (const f of vals) {
      if (f.seperate) {
        restFields.push(f)
      } else {
        mainFields.push(f)
      }
    }

    result.buf = Buffer.allocUnsafe(len)
    result.buf[0] = result.idUint8[0]
    result.buf[1] = result.idUint8[1]

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
          result.buf[i] = f.typeIndex
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
        result.buf[i] = f.prop
        i++
        result.buf[i] = f.typeIndex
        const name = encoder.encode(f.path.join('.'))
        fieldNames.push(name)
        fieldNameLen += name.byteLength + 1
      }
    }

    result.propNames = Buffer.allocUnsafe(fieldNameLen)
    let lastWritten = 0
    for (const f of fieldNames) {
      result.propNames[lastWritten] = f.byteLength
      result.propNames.set(f, lastWritten + 1)
      lastWritten += f.byteLength + 1
    }

    result.responseCtx = new BasedNode(result as SchemaTypeDef, parsed)

    if (stringFields > 0) {
      result.hasStringProp = true
      let max = 0
      for (const f of result.seperate) {
        if (isType(f, 'string')) {
          if (f.prop > max) {
            max = f.prop
          }
        }
      }
      result.stringProps = Buffer.allocUnsafe(max + 1)
      for (const f of result.seperate) {
        if (isType(f, 'string')) {
          result.stringProps[f.prop] = 1
          result.stringPropsLoop.push(f)
          result.stringPropsSize++
        }
      }
      result.stringPropsCurrent = Buffer.allocUnsafe(max + 1)
      result.stringProps.copy(result.stringPropsCurrent)
    }
  }

  return result as SchemaTypeDef
}
