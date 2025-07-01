import { PropDef, STRING, REFERENCE, REFERENCES } from '@based/schema/def'
import { RefModifyOpts } from './references.js'
import { ENCODER } from '@saulx/utils'

export function getEdgeSize(t: PropDef, ref: RefModifyOpts) {
  let size = 0
  for (const key in t.edges) {
    if (key in ref) {
      const edge = t.edges[key]
      const value = ref[key]
      if (edge.len === 0) {
        if (edge.typeIndex === STRING) {
          size += ENCODER.encode(value).byteLength + 4
        } else if (edge.typeIndex === REFERENCE) {
          size += 4
        } else if (edge.typeIndex === REFERENCES) {
          size += value.length * 4 + 4
        }
      } else {
        size += edge.len
      }
    }
  }
  return size
}
