import { getPropType, SchemaReference } from '../index.js'
import {
  PropDef,
  TYPE_INDEX_MAP,
  PropDefEdge,
  REFERENCES,
  REFERENCE,
  ENUM,
  NUMBER,
} from './types.js'
import { getPropLen, isSeparate, parseMinMaxStep } from './utils.js'
import { defaultValidation, VALIDATION_MAP } from './validation.js'

export const addEdges = (prop: PropDef, refProp: SchemaReference) => {
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

      // add default
      const edge: PropDefEdge = {
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
        start: prop.edgeMainLen,
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

      prop.edgeMainLen += edge.len
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
      } else {
        prop.reverseMainEdges[edge.start] = edge
      }
    }
  }
}
