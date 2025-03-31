import {
  isPropType,
  SchemaObject,
  StrictSchemaType,
  getPropType,
  SchemaLocales,
} from '../index.js'
import { setByPath } from '@saulx/utils'
import {
  PropDef,
  SchemaTypeDef,
  TYPE_INDEX_MAP,
  REFERENCES,
  REFERENCE,
  SchemaTypesParsedById,
  SchemaTypesParsed,
} from './types.js'
import { DEFAULT_MAP } from './defaultMap.js'
import { StrictSchema } from '../types.js'
import { makePacked } from './makePacked.js'
import { makeSeparateTextSort } from './makeSeparateTextSort.js'
import { makeSeparateSort } from './makeSeparateSort.js'
import { getPropLen } from './getPropLen.js'
import { isSeparate } from './utils.js'
import { addEdges } from './addEdges.js'
import { createEmptyDef } from './createEmptyDef.js'
import { hashObjectIgnoreKeyOrder } from '@saulx/hash'
import { fillEmptyMain, isZeroes } from './fillEmptyMain.js'
import { defaultValidation, VALIDATION_MAP } from './validation.js'

export const DEFAULT_BLOCK_CAPACITY = 100_000

export const updateTypeDefs = (
  schema: StrictSchema,
  schemaTypesParsed: SchemaTypesParsed,
  schemaTypesParsedById: SchemaTypesParsedById,
) => {
  for (const field in schemaTypesParsed) {
    if (field in schema.types) {
      continue
    }
    const id = schemaTypesParsed[field].id
    delete schemaTypesParsed[field]
    delete schemaTypesParsedById[id]
  }
  for (const field in schema.types) {
    const type = schema.types[field]
    if (
      schemaTypesParsed[field] &&
      schemaTypesParsed[field].checksum === hashObjectIgnoreKeyOrder(type) // bit weird..
    ) {
      continue
    } else {
      if (!type.id) {
        throw new Error('NEED ID ON TYPE')
      }
      const def = createSchemaTypeDef(
        field,
        type,
        schemaTypesParsed,
        schema.locales ?? {
          en: {},
        },
      )
      def.blockCapacity =
        field === '_root' ? 2147483647 : DEFAULT_BLOCK_CAPACITY // TODO this should come from somewhere else
      schemaTypesParsed[field] = def
      schemaTypesParsedById[type.id] = def
    }
  }
}

export const createSchemaTypeDef = (
  typeName: string,
  type: StrictSchemaType | SchemaObject,
  parsed: SchemaTypesParsed,
  locales: Partial<SchemaLocales>,
  result: Partial<SchemaTypeDef> = createEmptyDef(typeName, type, locales),
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
  result.locales = locales
  result.localeSize = Object.keys(locales).length
  result.idUint8[0] = result.id & 255
  result.idUint8[1] = result.id >> 8
  const target = type.props
  let separateSortProps: number = 0
  let separateSortText: number = 0
  for (const key in target) {
    // Create prop def
    const schemaProp = target[key]
    const propPath = [...path, key]
    const propType = getPropType(schemaProp)
    if (propType === 'object') {
      createSchemaTypeDef(
        typeName,
        schemaProp as SchemaObject,
        parsed,
        locales,
        result,
        propPath,
        false,
      )
    } else {
      const len = getPropLen(schemaProp)
      if (
        isPropType('string', schemaProp) ||
        isPropType('alias', schemaProp) ||
        isPropType('cardinality', schemaProp)
      ) {
        if (typeof schemaProp === 'object') {
          if (
            !(schemaProp.maxBytes < 61) ||
            !('max' in schemaProp && schemaProp.max < 31)
          ) {
            separateSortProps++
          }
        } else {
          separateSortProps++
        }
      } else if (isPropType('text', schemaProp)) {
        separateSortText++
      }
      const isseparate = isSeparate(schemaProp, len)
      const typeIndex = TYPE_INDEX_MAP[propType]
      const prop: PropDef = {
        typeIndex,
        __isPropDef: true,
        separate: isseparate,
        path: propPath,
        start: 0,
        validation:
          schemaProp.validate ?? VALIDATION_MAP[typeIndex] ?? defaultValidation,
        len,
        default: schemaProp.default ?? DEFAULT_MAP[typeIndex],
        prop: isseparate ? ++result.cnt : 0,
      }

      if (isPropType('enum', schemaProp)) {
        prop.enum = Array.isArray(schemaProp) ? schemaProp : schemaProp.enum
        prop.reverseEnum = {}
        for (let i = 0; i < prop.enum.length; i++) {
          prop.reverseEnum[prop.enum[i]] = i
        }
      } else if (isPropType('references', schemaProp)) {
        prop.inversePropName = schemaProp.items.prop
        prop.inverseTypeName = schemaProp.items.ref
        prop.dependent = schemaProp.items.dependent
        addEdges(prop, schemaProp.items)
      } else if (isPropType('reference', schemaProp)) {
        prop.inversePropName = schemaProp.prop
        prop.inverseTypeName = schemaProp.ref
        prop.dependent = schemaProp.dependent
        addEdges(prop, schemaProp)
      } else if (typeof schemaProp === 'object') {
        if (
          isPropType('string', schemaProp) ||
          isPropType('text', schemaProp)
        ) {
          prop.compression =
            'compression' in schemaProp && schemaProp.compression === 'none'
              ? 0
              : 1
        } else if (isPropType('timestamp', schemaProp) && 'on' in schemaProp) {
          if (schemaProp.on[0] === 'c') {
            result.createTs ??= []
            result.createTs.push(prop)
          } else if (schemaProp.on[0] === 'u') {
            result.createTs ??= []
            result.createTs.push(prop)
            result.updateTs ??= []
            result.updateTs.push(prop)
          }
        }
      }
      result.props[propPath.join('.')] = prop
      if (isseparate) {
        result.separate.push(prop)
      }
    }
  }
  if (top) {
    // Put top level together
    const vals = Object.values(result.props)
    vals.sort((a, b) => {
      if (
        b.separate &&
        (a.typeIndex === REFERENCES || a.typeIndex === REFERENCE)
      ) {
        return -1
      }
      return a.prop - b.prop
    })
    let lastProp = 0
    for (const p of vals) {
      if (p.separate) {
        p.prop = ++lastProp
      }
    }
    let len = 2
    for (const f of vals) {
      if (f.separate) {
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
    result.mainEmpty = fillEmptyMain(vals, result.mainLen)
    result.mainEmptyAllZeroes = isZeroes(result.mainEmpty)

    makePacked(result, typeName, vals, len)
    if (separateSortText > 0) {
      makeSeparateTextSort(result)
    }
    if (separateSortProps > 0) {
      makeSeparateSort(result)
    }
    for (const p in result.props) {
      const x = result.props[p]
      if (!x.separate) {
        result.main[x.start] = x
      } else {
        result.reverseProps[x.prop] = x
      }
    }
  }
  return result as SchemaTypeDef
}
