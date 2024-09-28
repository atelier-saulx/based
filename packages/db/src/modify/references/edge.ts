import { BasedDb } from '../../index.js'
import { PropDef, REFERENCE, REFERENCES, STRING } from '../../schema/types.js'
import { modifyError, ModifyState } from '../ModifyRes.js'
import { writeFixedLenValue } from '../fixedLen.js'
import { RefModify, RefModifyOpts } from './references.js'
import { simpleRefsPacked } from './simple.js'

export function getEdgeSize(propDef: PropDef, ref: RefModifyOpts) {
  let size = 0
  for (const key in propDef.edges) {
    if (key in ref) {
      const edge = propDef.edges[key]
      const value = ref[key]
      if (edge.len === 0) {
        const type = edge.typeIndex
        if (type === STRING) {
          const len = value.length
          size += len + len + 4
        } else if (type === REFERENCE) {
          size += 4
        } else if (type === REFERENCES) {
          size += value.length * 5 + 4
        }
      } else {
        size += edge.len
      }
    }
  }
  return size
}

export function calculateEdgesSize(
  propDef: PropDef,
  value: RefModify[],
  res: ModifyState,
): number {
  let size = 0
  let i = value.length
  while (i--) {
    let ref = value[i]
    if (typeof ref !== 'number') {
      if (ref instanceof ModifyState) {
        ref = ref.tmpId
      } else if (typeof ref === 'object') {
        size += getEdgeSize(propDef, ref) + 6
      } else {
        modifyError(res, propDef, value)
        return 0
      }
    } else {
      size += 6
    }
  }
  return size
}

export function writeEdges(
  propDef: PropDef,
  ref: RefModifyOpts,
  db: BasedDb,
  res: ModifyState,
) {
  for (const key in propDef.edges) {
    if (key in ref) {
      const edge = propDef.edges[key]
      const mod = db.modifyCtx
      const buf = mod.buffer
      let value = ref[key]
      buf[mod.len] = edge.prop
      buf[mod.len + 1] = edge.typeIndex
      // Buffer: [field] [typeIndex] [size] [data]
      if (edge.len === 0) {
        if (edge.typeIndex === STRING) {
          const size = buf.write(value, mod.len + 6, 'utf8')
          buf.writeUint32LE(size, mod.len + 2)
          mod.len += size + 6
        } else if (edge.typeIndex === REFERENCE) {
          // TODO: value get id
          if (typeof value !== 'number') {
            if (value instanceof ModifyState) {
              value = value.tmpId
            } else {
              modifyError(res, propDef, value)
              return true
            }
          }
          buf.writeUint32LE(value, mod.len + 2)
          mod.len += 6
        } else if (edge.typeIndex === REFERENCES) {
          const refLen = value.length * 4
          buf.writeUint32LE(refLen, mod.len + 2)
          mod.len += 6
          simpleRefsPacked(edge, db, value, res)
          mod.len += refLen
        }
      } else {
        writeFixedLenValue(db, value, mod.len + 2, edge, res)
        mod.len += edge.len + 2
      }
    }
  }
  return false
}
