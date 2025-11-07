import { getPropType, SchemaReference } from '../index.js'
import { DEFAULT_MAP } from './defaultMap.js'
import { fillEmptyMain } from './fillEmptyMain.js'
import {
  PropDef,
  TYPE_INDEX_MAP,
  PropDefEdge,
  REFERENCES,
  REFERENCE,
  ENUM,
  NUMBER,
} from './types.js'
import {
  getPropLen,
  isSeparate,
  parseMinMaxStep,
  sortMainProps,
} from './utils.js'
import { defaultValidation, VALIDATION_MAP } from './validation.js'

export const addEdges = (prop: PropDef, refProp: SchemaReference) => {
  const mainEdges: PropDefEdge[] = []
  for (const key in refProp) {
    if (key[0] === '$') {
      if (!prop.edges) {
        prop.edgeMainLen = 0
        prop.edges = {}
        prop.reverseSeperateEdges = {}
        prop.reverseMainEdges = {}
        prop.edgesSeperateCnt = 0
      }
      const edgeProp = refProp[key]
      const edgeType = getPropType(edgeProp)
      const len = getPropLen(edgeProp)
      const separate = isSeparate(edgeProp, len)
      if (separate) {
        prop.edgesSeperateCnt++
      }
      const typeIndex = TYPE_INDEX_MAP[edgeType]

      if (edgeProp.default !== undefined) {
        prop.hasDefaultEdges = true
      }

      // add default
      const edge: PropDefEdge = {
        schema: edgeProp,
        __isPropDef: true,
        __isEdge: true,
        prop: separate ? prop.edgesSeperateCnt : 0,
        validation:
          edgeProp.validation ?? VALIDATION_MAP[typeIndex] ?? defaultValidation,
        name: key,
        typeIndex,
        len,
        separate,
        path: [...prop.path, key],
        default: edgeProp.default ?? DEFAULT_MAP[typeIndex],
        // start: prop.edgeMainLen,
      }

      if (!separate) {
        mainEdges.push(edge)
      }

      if (edgeProp.max !== undefined) {
        edge.max = parseMinMaxStep(edgeProp.max)
      }

      if (edgeProp.min !== undefined) {
        edge.min = parseMinMaxStep(edgeProp.min)
      }

      if (edgeProp.step !== undefined) {
        edge.step = parseMinMaxStep(edgeProp.step)
      }

      if (edge.typeIndex !== NUMBER && edge.step === undefined) {
        edge.step = 1
      }

      if (edge.typeIndex === ENUM) {
        edge.enum = Array.isArray(refProp[key])
          ? refProp[key]
          : refProp[key].enum
        edge.reverseEnum = {}
        for (let i = 0; i < edge.enum.length; i++) {
          edge.reverseEnum[edge.enum[i]] = i
        }
      } else if (edge.typeIndex === REFERENCES) {
        edge.inverseTypeName = refProp[key].items.ref
      } else if (edge.typeIndex === REFERENCE) {
        edge.inverseTypeName = refProp[key].ref
      }
      prop.edges[key] = edge
      if (separate) {
        prop.reverseSeperateEdges[edge.prop] = edge
      }
    }
  }

  mainEdges.sort(sortMainProps)
  for (const edge of mainEdges) {
    edge.start = prop.edgeMainLen
    prop.edgeMainLen += edge.len
    prop.reverseMainEdges[edge.start] = edge
  }

  prop.edgeMainEmpty = fillEmptyMain(mainEdges, prop.edgeMainLen)
}
