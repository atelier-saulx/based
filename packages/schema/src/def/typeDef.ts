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
  SchemaTypesParsed,
  NUMBER,
} from './types.js'
import { DEFAULT_MAP } from './defaultMap.js'
import { StrictSchema } from '../types.js'
import { makeSeparateTextSort } from './makeSeparateTextSort.js'
import { makeSeparateSort } from './makeSeparateSort.js'
import { getPropLen, isSeparate, parseMinMaxStep } from './utils.js'
import { addEdges } from './addEdges.js'
import { createEmptyDef } from './createEmptyDef.js'
import { fillEmptyMain, isZeroes } from './fillEmptyMain.js'
import { defaultValidation, VALIDATION_MAP } from './validation.js'

export const BLOCK_CAPACITY_MIN = 1025
export const BLOCK_CAPACITY_MAX = 2147483647
export const BLOCK_CAPACITY_DEFAULT = 100_000

export const updateTypeDefs = (schema: StrictSchema) => {
  const schemaTypesParsed: { [key: string]: SchemaTypeDef } = {}
  const schemaTypesParsedById: { [id: number]: SchemaTypeDef } = {}
  for (const typeName in schemaTypesParsed) {
    if (typeName in schema.types) {
      continue
    }
    const id = schemaTypesParsed[typeName].id
    delete schemaTypesParsed[typeName]
    delete schemaTypesParsedById[id]
  }
  for (const typeName in schema.types) {
    const type = schema.types[typeName]
    if (!type.id) {
      throw new Error('NEED ID ON TYPE')
    }
    const def = createSchemaTypeDef(
      typeName,
      type,
      schemaTypesParsed,
      schema.locales ?? {
        en: {},
      },
    )
    def.blockCapacity = typeName === '_root' ? BLOCK_CAPACITY_MAX : BLOCK_CAPACITY_DEFAULT
    schemaTypesParsed[typeName] = def
    schemaTypesParsedById[type.id] = def
  }
  return { schemaTypesParsed, schemaTypesParsedById }
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
            result.separateSortProps++
          }
        } else {
          result.separateSortProps++
        }
      } else if (isPropType('text', schemaProp)) {
        result.separateSortText++
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
          schemaProp.validation ??
          VALIDATION_MAP[typeIndex] ??
          defaultValidation,
        len,
        default: schemaProp.default ?? DEFAULT_MAP[typeIndex],
        prop: isseparate ? ++result.cnt : 0,
      }

      if (schemaProp.max !== undefined) {
        prop.max = parseMinMaxStep(schemaProp.max)
      }

      if (schemaProp.min !== undefined) {
        prop.min = parseMinMaxStep(schemaProp.min)
      }

      if (schemaProp.step !== undefined) {
        prop.step = parseMinMaxStep(schemaProp.step)
      }

      if (prop.typeIndex !== NUMBER && prop.step === undefined) {
        prop.step = 1
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

    if (result.separateSortText > 0) {
      makeSeparateTextSort(result)
    }
    if (result.separateSortProps > 0) {
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
