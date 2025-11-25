import { getValidator, SchemaReference } from '../index.js'
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
      const edgeType = edgeProp.type
      const len = getPropLen(edgeProp)
      const separate = isSeparate(edgeProp, len)
      if (separate) {
        prop.edgesSeperateCnt ??= 0
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
        prop: separate ? (prop.edgesSeperateCnt ?? 0) : 0,
        validation: getValidator(edgeProp),
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
        edgeProp.max = edge.max = parseMinMaxStep(edgeProp.max)
      }

      if (edgeProp.min !== undefined) {
        edgeProp.min = edge.min = parseMinMaxStep(edgeProp.min)
      }

      if (edgeProp.step !== undefined) {
        edgeProp.step = edge.step = parseMinMaxStep(edgeProp.step)
      }

      if (edge.typeIndex !== NUMBER && edge.step === undefined) {
        edge.step = 1
      }

      if (edge.typeIndex === ENUM) {
        edge.enum = Array.isArray(refProp[key])
          ? refProp[key]
          : refProp[key].enum
        edge.reverseEnum = {}
        // @ts-ignore
        for (let i = 0; i < edge.enum.length; i++) {
          // @ts-ignore
          edge.reverseEnum[edge.enum[i]] = i
        }
      } else if (edge.typeIndex === REFERENCES) {
        edge.inverseTypeName = refProp[key].items.ref
      } else if (edge.typeIndex === REFERENCE) {
        edge.inverseTypeName = refProp[key].ref
      }
      prop.edges[key] = edge
      if (separate) {
        // @ts-ignore
        prop.reverseSeperateEdges[edge.prop] = edge
      }
    }
  }

  mainEdges.sort(sortMainProps)
  for (const edge of mainEdges) {
    edge.start = prop.edgeMainLen
    // @ts-ignore
    prop.edgeMainLen += edge.len
    // @ts-ignore
    prop.reverseMainEdges[edge.start] = edge
  }
  // @ts-ignore
  prop.edgeMainEmpty = fillEmptyMain(mainEdges, prop.edgeMainLen)
}
