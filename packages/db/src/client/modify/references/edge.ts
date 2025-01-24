import { BasedDb, ModifyCtx } from '../../../index.js'
import {
  BINARY,
  PropDef,
  PropDefEdge,
  REFERENCE,
  REFERENCES,
  STRING,
} from '../../../server/schema/types.js'
import { write } from '../../string.js'
import { getBuffer, writeBinaryRaw } from '../binary.js'
import { ModifyError, ModifyState } from '../ModifyRes.js'
import { ModifyErr, RANGE_ERR } from '../types.js'
import { appendFixedValue } from '../fixed.js'
import { RefModifyOpts } from './references.js'

export function getEdgeSize(t: PropDef, ref: RefModifyOpts) {
  let size = 0
  for (const key in t.edges) {
    if (key in ref) {
      const edge = t.edges[key]
      const value = ref[key]
      if (edge.len === 0) {
        if (edge.typeIndex === STRING) {
          size += Buffer.byteLength(value) + 4
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

function appendRefs(t: PropDefEdge, ctx: ModifyCtx, value: any[]): ModifyErr {
  for (let i = 0; i < value.length; i++) {
    let id = value[i]
    if (typeof id !== 'number') {
      if (id instanceof ModifyState) {
        if (id.error) {
          return id.error
        }
        id = id.tmpId
      } else {
        return new ModifyError(t, value)
      }
    }

    if (id > 0) {
      ctx.buf[ctx.len++] = id
      ctx.buf[ctx.len++] = id >>>= 8
      ctx.buf[ctx.len++] = id >>>= 8
      ctx.buf[ctx.len++] = id >>>= 8
    } else {
      return new ModifyError(t, value)
    }
  }
}

export function writeEdges(
  t: PropDef,
  ref: RefModifyOpts,
  ctx: ModifyCtx,
): ModifyErr {
  for (const key in t.edges) {
    if (key in ref) {
      const edge = t.edges[key]
      let value = ref[key]

      if (edge.len === 0) {
        if (edge.typeIndex === BINARY) {
          let size = 0
          if (value === null) {
            size = 0
          } else {
            const buf = getBuffer(value)
            if (!buf) {
              return new ModifyError(t, ref)
            }
            size = buf.byteLength
          }

          if (ctx.len + 6 + size > ctx.max) {
            return RANGE_ERR
          }

          ctx.buf[ctx.len++] = edge.prop
          ctx.buf[ctx.len++] = STRING

          if (size) {
            writeBinaryRaw(value, ctx)
          } else {
            ctx.buf[ctx.len++] = 0
            ctx.buf[ctx.len++] = 0
            ctx.buf[ctx.len++] = 0
            ctx.buf[ctx.len++] = 0
          }
        } else if (edge.typeIndex === STRING) {
          if (typeof value !== 'string') {
            return new ModifyError(t, ref)
          }
          if (ctx.len + 6 + Buffer.byteLength(value) > ctx.max) {
            return RANGE_ERR
          }
          ctx.buf[ctx.len++] = edge.prop
          ctx.buf[ctx.len++] = STRING
          let size = write(ctx.buf, value, ctx.len + 4, ctx.db.noCompression)
          let sizeU32 = size
          ctx.buf[ctx.len++] = sizeU32
          ctx.buf[ctx.len++] = sizeU32 >>>= 8
          ctx.buf[ctx.len++] = sizeU32 >>>= 8
          ctx.buf[ctx.len++] = sizeU32 >>>= 8
          ctx.len += size
        } else if (edge.typeIndex === REFERENCE) {
          if (typeof value !== 'number') {
            if (value instanceof ModifyState) {
              value = value.tmpId
            } else {
              return new ModifyError(t, ref)
            }
          }
          if (value > 0) {
            ctx.buf[ctx.len++] = edge.prop
            ctx.buf[ctx.len++] = REFERENCE
            ctx.buf[ctx.len++] = value
            ctx.buf[ctx.len++] = value >>>= 8
            ctx.buf[ctx.len++] = value >>>= 8
            ctx.buf[ctx.len++] = value >>>= 8
          } else {
            return new ModifyError(t, ref)
          }
        } else if (edge.typeIndex === REFERENCES) {
          if (!Array.isArray(value)) {
            return new ModifyError(t, ref)
          }
          let size = value.length * 4
          if (ctx.len + 6 + size > ctx.max) {
            return RANGE_ERR
          }
          ctx.buf[ctx.len++] = edge.prop
          ctx.buf[ctx.len++] = REFERENCES
          ctx.buf[ctx.len++] = size
          ctx.buf[ctx.len++] = size >>>= 8
          ctx.buf[ctx.len++] = size >>>= 8
          ctx.buf[ctx.len++] = size >>>= 8
          appendRefs(edge, ctx, value)
        }
      } else {
        if (ctx.len + 2 > ctx.max) {
          return RANGE_ERR
        }
        ctx.buf[ctx.len++] = edge.prop
        ctx.buf[ctx.len++] = edge.typeIndex
        const err = appendFixedValue(ctx, value, edge)
        if (err) {
          return err
        }
      }
    }
  }
}
