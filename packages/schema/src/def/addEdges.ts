import { getPropType, SchemaReference } from '../index.js'
import {
  PropDef,
  SIZE_MAP,
  TYPE_INDEX_MAP,
  PropDefEdge,
  REFERENCES,
  REFERENCE,
  ENUM,
} from './types.js'

export const addEdges = (prop: PropDef, refProp: SchemaReference) => {
  let edgesCnt = 0
  for (const key in refProp) {
    if (key[0] === '$') {
      if (!prop.edges) {
        prop.edges = {}
        prop.reverseEdges = {}
        prop.edgesTotalLen = 0
      }
      edgesCnt++
      const edgeType = getPropType(refProp[key])
      const edge: PropDefEdge = {
        __isPropDef: true,
        __isEdge: true,
        prop: edgesCnt,
        name: key,
        typeIndex: TYPE_INDEX_MAP[edgeType],
        len: SIZE_MAP[edgeType],
        separate: true,
        path: [...prop.path, key],
      }
      if (edge.len == 0) {
        prop.edgesTotalLen = 0
      } else {
        // [field] [size] [data]
        prop.edgesTotalLen += 1 + 2 + edge.len // field len
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
      prop.reverseEdges[edge.prop] = edge
    }
  }
}
