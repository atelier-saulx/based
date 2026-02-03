import {
  SchemaObject,
  SchemaHooks,
  getValidator,
  type SchemaOut,
} from '../index.js'
import { setByPath } from '../../utils/index.js'
import {
  PropDef,
  SchemaTypeDef,
  BLOCK_CAPACITY_MAX,
  BLOCK_CAPACITY_DEFAULT,
  BLOCK_CAPACITY_MIN,
} from './types.js'
import { DEFAULT_MAP } from './defaultMap.js'
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
import type { SchemaType } from '../schema/type.js'
import { PropType } from '../../zigTsExports.js'
import type { SchemaLocales } from '../schema/locales.js'

export const updateTypeDefs = (schema: SchemaOut) => {
  const schemaTypesParsed: { [key: string]: SchemaTypeDef } = {}
  const schemaTypesParsedById: { [id: number]: SchemaTypeDef } = {}

  let typeIdCnt = 1
  for (const typeName of Object.keys(schema.types).sort()) {
    const type = schema.types[typeName]
    const locales = schema.locales ?? { en: {} }
    const result = createEmptyDef(typeName, type, locales)
    result.id = typeIdCnt++
    const def = createSchemaTypeDef(typeName, type, locales, result)
    schemaTypesParsed[typeName] = def
    schemaTypesParsedById[def.id] = def
  }

  for (const schemaType of Object.values(schemaTypesParsed)) {
    for (const prop of Object.values(schemaType.props)) {
      if (
        prop.typeIndex === PropType.reference ||
        prop.typeIndex === PropType.references
      ) {
        // FIXME Now references in edgeType are missing __isEdge
        // However, we can soon just delete weak refs
        if (!prop.__isEdge && !prop.inversePropName) {
          prop.__isEdge = true
        }

        if (!prop.__isEdge) {
          // Update inverseProps in references
          const dstType: SchemaTypeDef =
            schemaTypesParsed[prop.inverseTypeName as string]
          prop.inverseTypeId = dstType.id
          prop.inversePropNumber =
            dstType.props[prop.inversePropName as string].prop

          if (prop.edges) {
            if (dstType.props[prop.inversePropName as string].edges) {
              // this currently is not allowed, but might be
              const mergedEdges = {
                ...dstType.props[prop.inversePropName as string].edges,
                ...prop.edges,
              }
              dstType.props[prop.inversePropName as string].edges = mergedEdges
              prop.edges = mergedEdges
            } else {
              dstType.props[prop.inversePropName as string].edges = prop.edges
            }
          }

          // Update edgeNodeTypeId
          if (!prop.edgeNodeTypeId) {
            if (prop.edges) {
              const edgeTypeName = `_${[`${schemaType.type}_${prop.path.join('_')}`, `${dstType.type}_${dstType.props[prop.inversePropName as string].path.join('_')}`].sort().join(':')}`

              if (!schemaTypesParsed[edgeTypeName]) {
                // make it
                //prop.edges, schema.types

                // const type = schema.types[edgeTypeName]
                const fakeEdgeType: any = {}
                for (const k in prop.edges) {
                  fakeEdgeType[k] = prop.edges[k].schema
                }
                const locales = schema.locales ?? { en: {} }
                const result = createEmptyDef(
                  edgeTypeName,
                  fakeEdgeType,
                  locales,
                )
                result.id = typeIdCnt++
                const def = createSchemaTypeDef(
                  edgeTypeName,
                  fakeEdgeType,
                  locales,
                  result,
                )
                schemaTypesParsed[edgeTypeName] = def
                schemaTypesParsedById[def.id] = def
              }

              const edgeType = schemaTypesParsed[edgeTypeName]

              prop.edgeNodeTypeId = edgeType.id
              dstType.props[prop.inversePropName as string].edgeNodeTypeId =
                edgeType.id
              // prop.edgeType = edgeType
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
  type: SchemaType<true> | SchemaObject<true>,
  locales: Partial<SchemaLocales>,
  result: Partial<SchemaTypeDef>,
  path: string[] = [],
  top: boolean = true,
): SchemaTypeDef => {
  if (top) {
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
    if (result.capped == 0) {
      if ('capped' in type) {
        if (typeof type.capped !== 'number' || type.capped < 0) {
          throw new Error('Invalid capped')
        }
        result.capped = type.capped
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
  ;(result.idUint8 as any)[0] = (result.id as number) & 255
  ;(result.idUint8 as any)[1] = (result.id as number) >> 8
  const target = type.props

  for (const key in target) {
    // Create prop def
    const schemaProp = target[key]
    const propPath = [...path, key]
    const propType = schemaProp.type
    if (propType === 'object') {
      createSchemaTypeDef(
        typeName,
        schemaProp as SchemaObject<true>,
        locales,
        result,
        propPath,
        false,
      )
      continue
    }

    const len = getPropLen(schemaProp)
    if (
      schemaProp.type === 'string' ||
      schemaProp.type === 'alias' ||
      schemaProp.type === 'cardinality'
    ) {
      if (typeof schemaProp === 'object') {
        if (
          !(schemaProp.maxBytes && schemaProp.maxBytes < 61) ||
          !('max' in schemaProp && schemaProp.max && schemaProp.max < 31)
        ) {
          result.separateSortProps ??= 0
          result.separateSortProps++
        }
      } else {
        result.separateSortProps ??= 0
        result.separateSortProps++
      }
    } else if (schemaProp.type === 'text') {
      result.separateSortText ??= 0
      result.separateSortText++
    } else if (schemaProp.type === 'colvec') {
      if (!result.insertOnly) {
        throw new Error('colvec requires insertOnly')
      }
    }
    const isseparate = isSeparate(schemaProp, len)
    const typeIndex = PropType[propType]
    result.cnt ??= 0
    const prop: PropDef = {
      schema: schemaProp,
      typeIndex,
      __isPropDef: true,
      separate: isseparate,
      path: propPath,
      start: 0,
      validation: getValidator(schemaProp),
      len,
      default:
        ('default' in schemaProp ? schemaProp.default : null) ??
        DEFAULT_MAP[typeIndex],
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

    if ('max' in schemaProp && schemaProp.max !== undefined) {
      schemaProp.max = prop.max = parseMinMaxStep(schemaProp.max)
    }

    if ('min' in schemaProp && schemaProp.min !== undefined) {
      schemaProp.min = prop.min = parseMinMaxStep(schemaProp.min)
    }

    if ('step' in schemaProp && schemaProp.step !== undefined) {
      schemaProp.step = prop.step = parseMinMaxStep(schemaProp.step)
    }

    if (prop.typeIndex !== PropType.number && prop.step === undefined) {
      prop.step = 1
    }
    if (
      prop.typeIndex === PropType.vector ||
      prop.typeIndex === PropType.colVec
    ) {
      prop.vectorBaseType = schemaVectorBaseTypeToEnum(
        ('baseType' in schemaProp && schemaProp.baseType) || 'number',
      )
    }

    if (schemaProp.type === 'cardinality') {
      prop.cardinalityMode ??= cardinalityModeToEnum(
        (schemaProp.mode ??= 'sparse'),
      )
      const prec = typeName == '_root' ? 14 : 8
      prop.cardinalityPrecision ??= schemaProp.precision ??= prec
    }

    if (schemaProp.type === 'enum') {
      // @ts-ignore
      prop.enum = Array.isArray(schemaProp) ? schemaProp : schemaProp.enum
      prop.reverseEnum = {}
      // @ts-ignore
      for (let i = 0; i < prop.enum.length; i++) {
        // @ts-ignore
        prop.reverseEnum[prop.enum[i]] = i
      }
    } else if (schemaProp.type === 'references') {
      if (result.partial) {
        throw new Error('references is not supported with partial')
      }

      prop.inversePropName = schemaProp.items.prop
      prop.inverseTypeName = schemaProp.items.ref
      prop.dependent = schemaProp.items.dependent
      prop.referencesCapped = schemaProp.capped ?? 0
      addEdges(prop, schemaProp.items)
    } else if (schemaProp.type === 'reference') {
      if (result.partial) {
        throw new Error('reference is not supported with partial')
      }

      prop.inversePropName = schemaProp.prop
      prop.inverseTypeName = schemaProp.ref
      prop.dependent = schemaProp.dependent
      addEdges(prop, schemaProp)
    } else if (typeof schemaProp === 'object') {
      if (schemaProp.type === 'string' || schemaProp.type === 'text') {
        prop.compression =
          'compression' in schemaProp && schemaProp.compression === 'none'
            ? 0
            : 1
      } else if (schemaProp.type === 'timestamp' && schemaProp.on) {
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
    result.props ??= {}
    result.props[propPath.join('.')] = prop
    if (isseparate) {
      result.separate ??= []
      result.separate.push(prop)
    }
  }

  if (top) {
    // Put top level together
    const vals = Object.values(result.props || {})
    reorderProps(vals)
    let len = 2
    let biggestSeperatePropDefault = 0

    for (const f of vals) {
      if (f.separate) {
        len += 2
        setByPath(result.tree, f.path, f)
        if (f.default !== undefined) {
          result.hasSeperateDefaults = true
        }
      }
    }

    const mainProps = vals.filter((v) => !v.separate).sort(sortMainProps)
    for (const f of mainProps) {
      if (!result.mainLen) {
        len += 2
      }
      len += 1
      f.start = result.mainLen ?? 0
      result.mainLen ??= 0
      result.mainLen += f.len
      setByPath(result.tree, f.path, f)
    }

    result.mainEmpty = fillEmptyMain(vals, result.mainLen ?? 0)
    result.mainEmptyAllZeroes = isZeroes(result.mainEmpty)

    // @ts-ignore
    if (result.separateSortText > 0) {
      // @ts-ignore
      makeSeparateTextSort(result)
    }
    // @ts-ignore
    if (result.separateSortProps > 0) {
      makeSeparateSort(result)
    }
    for (const p in result.props) {
      const x = result.props[p]
      if (!x.separate) {
        // @ts-ignore
        result.main[x.start] = x
      } else {
        // @ts-ignore
        result.reverseProps[x.prop] = x
      }
    }
  }
  return result as SchemaTypeDef
}
