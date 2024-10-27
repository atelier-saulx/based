import { BasedDb } from '../../index.js'
import {
  BINARY,
  PropDef,
  PropDefEdge,
  REFERENCE,
  REFERENCES,
  STRING,
} from '../../schema/types.js'
import { modifyError, ModifyState } from '../ModifyRes.js'
import {
  appendBufWithSize,
  appendFixedValue,
  appendU32,
  appendU8,
  appendUtf8WithSize,
} from '../utils.js'
import { RefModify, RefModifyOpts } from './references.js'

export function getEdgeSize(t: PropDef, ref: RefModifyOpts) {
  var size = 0
  for (const key in t.edges) {
    if (key in ref) {
      const edge = t.edges[key]
      const value = ref[key]
      if (edge.len === 0) {
        if (edge.typeIndex === STRING) {
          const len = value.length
          size += len + len + 4
        } else if (edge.typeIndex === REFERENCE) {
          size += 4
        } else if (edge.typeIndex === REFERENCES) {
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
  t: PropDef,
  value: RefModify[],
  res: ModifyState,
): number {
  let size = 0
  for (let i = 0; i < value.length; i++) {
    let ref = value[i]
    if (typeof ref !== 'number') {
      if (ref instanceof ModifyState) {
        ref = ref.tmpId
      } else if (typeof ref === 'object') {
        size += getEdgeSize(t, ref) + 6
      } else {
        modifyError(res, t, value)
        return 0
      }
    } else {
      size += 6
    }
  }
  return size
}

function appendRefs(
  t: PropDefEdge,
  ctx: BasedDb['modifyCtx'],
  value: any[],
  res: ModifyState,
) {
  // TODO this has to be with index!!
  for (let i = 0; i < value.length; i++) {
    let ref = value[i]
    let id: number
    let $index: number

    if (typeof ref !== 'number') {
      if (ref instanceof ModifyState) {
        if (ref.error) {
          res.error = ref.error
          return
        }
        id = ref.tmpId
      } else if (typeof ref === 'object' && 'id' in ref) {
        id = ref.id
        if ('$index' in ref) {
          $index = ref.$index
        }
      } else {
        modifyError(res, t, value)
        return
      }
    } else {
      id = ref
    }

    appendU32(ctx, id)
  }
}

export function writeEdges(
  t: PropDef,
  ref: RefModifyOpts,
  ctx: BasedDb['modifyCtx'],
  res: ModifyState,
) {
  for (const key in t.edges) {
    if (key in ref) {
      const edge = t.edges[key]
      let value = ref[key]
      appendU8(ctx, edge.prop)
      if (edge.len === 0) {
        if (edge.typeIndex === BINARY) {
          appendU8(ctx, STRING)
          if (value && value.buffer instanceof ArrayBuffer) {
            value = Buffer.from(value)
          }
          appendBufWithSize(ctx, value)
        } else if (edge.typeIndex === STRING) {
          appendU8(ctx, STRING)
          appendUtf8WithSize(ctx, value)
        } else if (edge.typeIndex === REFERENCE) {
          // TODO: value get id
          if (typeof value !== 'number') {
            if (value instanceof ModifyState) {
              value = value.tmpId
            } else {
              modifyError(res, t, value)
              return true
            }
          }
          appendU8(ctx, REFERENCE)
          appendU32(ctx, value)
        } else if (edge.typeIndex === REFERENCES) {
          appendU8(ctx, REFERENCES)
          appendU32(ctx, value.length * 4)
          appendRefs(edge, ctx, value, res)
        }
      } else {
        appendU8(ctx, edge.typeIndex)
        if (appendFixedValue(ctx, value, edge)) {
          modifyError(res, t, value)
          return true
        }
      }
    }
  }
  return false
}
