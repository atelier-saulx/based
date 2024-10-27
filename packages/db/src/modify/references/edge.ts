import { BasedDb } from '../../index.js'
import {
  BINARY,
  PropDef,
  REFERENCE,
  REFERENCES,
  STRING,
} from '../../schema/types.js'
import { modifyError, ModifyState } from '../ModifyRes.js'
import { writeFixedLenValue } from '../fixedLen.js'
import { appendU8 } from '../utils.js'
import { RefModify, RefModifyOpts } from './references.js'
import { simpleRefsPacked } from './simple.js'

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
      // appendU8(ctx, edge.prop)
      // appendU8(ctx, edge.typeIndex)
      ctx.buf[ctx.len] = edge.prop
      ctx.buf[ctx.len + 1] = edge.typeIndex
      if (edge.len === 0) {
        if (edge.typeIndex === BINARY) {
          // appendU8(ctx, 11)
          ctx.buf[ctx.len + 1] = 11
          if (value && value.buffer instanceof ArrayBuffer) {
            value = Buffer.from(value)
          }
          const size = value.byteLength

          ctx.buf.set(value, ctx.len + 6)
          ctx.buf.writeUint32LE(size, ctx.len + 2)
          ctx.len += size + 6
        } else if (edge.typeIndex === STRING) {
          const size = ctx.buf.write(value, ctx.len + 6, 'utf8')
          ctx.buf.writeUint32LE(size, ctx.len + 2)
          ctx.len += size + 6
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
          ctx.buf.writeUint32LE(value, ctx.len + 2)
          ctx.len += 6
        } else if (edge.typeIndex === REFERENCES) {
          const refLen = value.length * 4
          ctx.buf.writeUint32LE(refLen, ctx.len + 2)
          ctx.len += 6
          simpleRefsPacked(edge, ctx, value, res)
          ctx.len += refLen
        }
      } else {
        writeFixedLenValue(ctx, value, ctx.len + 2, edge, res)
        ctx.len += edge.len + 2
      }
    }
  }
  return false
}
