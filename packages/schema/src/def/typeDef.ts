import {
  isPropType,
  SchemaObject,
  StrictSchemaType,
  getPropType,
  SchemaLocales,
  SchemaHooks,
} from '../index.js'
import { setByPath } from '@based/utils'
import {
  PropDef,
  SchemaTypeDef,
  TYPE_INDEX_MAP,
  REFERENCES,
  REFERENCE,
  SchemaTypesParsed,
  NUMBER,
  BLOCK_CAPACITY_MAX,
  BLOCK_CAPACITY_DEFAULT,
  BLOCK_CAPACITY_MIN,
  VECTOR,
  COLVEC,
  CARDINALITY,
} from './types.js'
import { DEFAULT_MAP } from './defaultMap.js'
import { StrictSchema } from '../types.js'
import { makeSeparateTextSort } from './makeSeparateTextSort.js'
import { makeSeparateSort } from './makeSeparateSort.js'
import {
  getPropLen,
  isSeparate,
  parseMinMaxStep,
  reorderProps,
  schemaVectorBaseTypeToEnum,
  sortMainProps,
  cardinalityModeToEnum,
} from './utils.js'
import { addEdges } from './addEdges.js'
import { createEmptyDef } from './createEmptyDef.js'
import { fillEmptyMain, isZeroes } from './fillEmptyMain.js'
import { defaultValidation, VALIDATION_MAP } from './validation.js'

export const updateTypeDefs = (schema: StrictSchema) => {
  const schemaTypesParsed: { [key: string]: SchemaTypeDef } = {}
  const schemaTypesParsedById: { [id: number]: SchemaTypeDef } = {}

  for (const typeName in schema.types) {
    const type = schema.types[typeName]
    if (!type.id) {
      throw new Error('NEED ID ON TYPE')
    }
    const def = createSchemaTypeDef(
      typeName,
      type,
      schema.locales ?? {
        en: {},
      },
    )
    schemaTypesParsed[typeName] = def
    schemaTypesParsedById[type.id] = def
  }

  for (const schema of Object.values(schemaTypesParsed)) {
    for (const prop of Object.values(schema.props)) {
      if (prop.typeIndex === REFERENCE || prop.typeIndex === REFERENCES) {
        // FIXME Now references in edgeType are missing __isEdge
        // However, we can soon just delete weak refs
        if (!prop.__isEdge && !prop.inversePropName) {
          prop.__isEdge = true
        }

        if (!prop.__isEdge) {
          // Update inverseProps in references
          const dstType: SchemaTypeDef = schemaTypesParsed[prop.inverseTypeName]
          prop.inverseTypeId = dstType.id
          prop.inversePropNumber = dstType.props[prop.inversePropName].prop

          if (prop.edges) {
            if (dstType.props[prop.inversePropName].edges) {
              // this currently is not allowed, but might be
              const mergedEdges = {
                ...dstType.props[prop.inversePropName].edges,
                ...prop.edges,
              }
              dstType.props[prop.inversePropName].edges = mergedEdges
              prop.edges = mergedEdges
            } else {
              dstType.props[prop.inversePropName].edges = prop.edges
            }
          }

          // Update edgeNodeTypeId
          if (!prop.edgeNodeTypeId) {
            if (prop.edges) {
              const edgeTypeName = `_${schema.type}:${prop.path.join('.')}`
              const edgeType = schemaTypesParsed[edgeTypeName]

              prop.edgeNodeTypeId = edgeType.id
              dstType.props[prop.inversePropName].edgeNodeTypeId = edgeType.id
            } else {
              prop.edgeNodeTypeId = 0
            }
          }
        }
      }
    }
  }

  return { schemaTypesParsed, schemaTypesParsedById }
}

const createSchemaTypeDef = (
  typeName: string,
  type: StrictSchemaType | SchemaObject,
  locales: Partial<SchemaLocales>,
  result: Partial<SchemaTypeDef> = createEmptyDef(typeName, type, locales),
  path: string[] = [],
  top: boolean = true,
): SchemaTypeDef => {
  if (top) {
    if (result.id == 0) {
      if ('id' in type) {
        result.id = type.id
      } else {
        throw new Error(`Invalid schema type id ${result.type}`)
      }
    }
    if (result.blockCapacity == 0) {
      if ('blockCapacity' in type) {
        if (
          typeof type.blockCapacity !== 'number' ||
          type.blockCapacity < BLOCK_CAPACITY_MIN ||
          type.blockCapacity > BLOCK_CAPACITY_MAX
        ) {
          throw new Error('Invalid blockCapacity')
        }
        result.blockCapacity = type.blockCapacity
      } else {
        result.blockCapacity =
          typeName === '_root' ? BLOCK_CAPACITY_MAX : BLOCK_CAPACITY_DEFAULT
      }
    }
    if (result.insertOnly == false && 'insertOnly' in type) {
      result.insertOnly = !!type.insertOnly
    }
    if (result.partial == false && 'partial' in type) {
      result.partial = !!type.partial
    }
    if ('hooks' in type) {
      result.hooks = type.hooks as SchemaHooks
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
        locales,
        result,
        propPath,
        false,
      )
      continue
    }

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
    } else if (isPropType('colvec', schemaProp)) {
      if (!result.insertOnly) {
        throw new Error('colvec requires insertOnly')
      }
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
        schemaProp.validation ?? VALIDATION_MAP[typeIndex] ?? defaultValidation,
      len,
      default: schemaProp.default ?? DEFAULT_MAP[typeIndex],
      prop: isseparate ? ++result.cnt : 0,
    }

    if (schemaProp.hooks) {
      result.propHooks ??= {}
      for (const key in schemaProp.hooks) {
        prop.hooks = schemaProp.hooks
        result.propHooks[key] ??= new Set()
        result.propHooks[key].add(prop)
      }
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
    if (prop.typeIndex === VECTOR || prop.typeIndex === COLVEC) {
      prop.vectorBaseType = schemaVectorBaseTypeToEnum(
        schemaProp.baseType ?? 'number',
      )
    }

    if (prop.typeIndex === CARDINALITY) {
      prop.cardinalityMode ??= cardinalityModeToEnum(
        (schemaProp.mode ??= 'sparse'),
      )
      const prec = typeName == '_root' ? 14 : 8
      prop.cardinalityPrecision ??= schemaProp.precision ??= prec
    }

    if (isPropType('enum', schemaProp)) {
      prop.enum = Array.isArray(schemaProp) ? schemaProp : schemaProp.enum
      prop.reverseEnum = {}
      for (let i = 0; i < prop.enum.length; i++) {
        prop.reverseEnum[prop.enum[i]] = i
      }
    } else if (isPropType('references', schemaProp)) {
      if (result.partial) {
        throw new Error('references is not supported with partial')
      }

      prop.inversePropName = schemaProp.items.prop
      prop.inverseTypeName = schemaProp.items.ref
      prop.dependent = schemaProp.items.dependent
      addEdges(prop, schemaProp.items)
    } else if (isPropType('reference', schemaProp)) {
      if (result.partial) {
        throw new Error('reference is not supported with partial')
      }

      prop.inversePropName = schemaProp.prop
      prop.inverseTypeName = schemaProp.ref
      prop.dependent = schemaProp.dependent
      addEdges(prop, schemaProp)
    } else if (typeof schemaProp === 'object') {
      if (isPropType('string', schemaProp) || isPropType('text', schemaProp)) {
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
  if (top) {
    // Put top level together
    const vals = Object.values(result.props)
    reorderProps(vals)
    let len = 2
    let biggestSeperatePropDefault = 0

    for (const f of vals) {
      if (f.separate) {
        len += 2
        setByPath(result.tree, f.path, f)
        if (f.default !== undefined) {
          result.hasSeperateDefaults = true
          if (!result.separateDefaults) {
            result.separateDefaults = {
              props: new Map(),
              bufferTmp: new Uint8Array(),
            }
          }
          result.separateDefaults.props.set(f.prop, f)
          if (f.prop > biggestSeperatePropDefault) {
            biggestSeperatePropDefault = f.prop
          }
        }
      }
    }

    const mainProps = vals.filter((v) => !v.separate).sort(sortMainProps)
    for (const f of mainProps) {
      if (!result.mainLen) {
        len += 2
      }
      len += 1
      f.start = result.mainLen
      result.mainLen += f.len
      setByPath(result.tree, f.path, f)
    }

    if (result.hasSeperateDefaults) {
      result.separateDefaults.bufferTmp = new Uint8Array(
        biggestSeperatePropDefault + 1,
      )
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
