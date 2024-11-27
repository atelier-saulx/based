import { BasedDb } from '../../../index.js'
import {
  BINARY,
  PropDef,
  PropDefEdge,
  REFERENCE,
  REFERENCES,
  STRING,
} from '../../../server/schema/types.js'
import { write } from '../../string.js'
import { getBuffer } from '../binary.js'
import { ModifyError, ModifyState } from '../ModifyRes.js'
import { ModifyErr, RANGE_ERR } from '../types.js'
import {
  appendBuf,
  appendFixedValue,
  appendU32,
  appendU8,
  outOfRange,
} from '../utils.js'
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

function appendRefs(
  t: PropDefEdge,
  ctx: BasedDb['modifyCtx'],
  value: any[],
): ModifyErr {
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
      appendU32(ctx, id)
    } else {
      return new ModifyError(t, value)
    }
  }
}

export function writeEdges(
  t: PropDef,
  ref: RefModifyOpts,
  ctx: BasedDb['modifyCtx'],
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
          if (outOfRange(ctx, 6 + size)) {
            return RANGE_ERR
          }
          appendU8(ctx, edge.prop)
          appendU8(ctx, STRING)
          appendU32(ctx, size)
          if (size) {
            appendBuf(ctx, value)
          }
        } else if (edge.typeIndex === STRING) {
          if (typeof value !== 'string') {
            return new ModifyError(t, ref)
          }
          let size = Buffer.byteLength(value)
          if (outOfRange(ctx, 6 + size)) {
            return RANGE_ERR
          }
          appendU8(ctx, edge.prop)
          appendU8(ctx, STRING)
          size = write(ctx.buf, value, ctx.len + 4, ctx.db.noCompression)
          appendU32(ctx, size)
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
            appendU8(ctx, edge.prop)
            appendU8(ctx, REFERENCE)
            appendU32(ctx, value)
          } else {
            return new ModifyError(t, ref)
          }
        } else if (edge.typeIndex === REFERENCES) {
          if (!Array.isArray(value)) {
            return new ModifyError(t, ref)
          }
          if (outOfRange(ctx, 6 + value.length * 4)) {
            return RANGE_ERR
          }
          appendU8(ctx, edge.prop)
          appendU8(ctx, REFERENCES)
          appendU32(ctx, value.length * 4)
          appendRefs(edge, ctx, value)
        }
      } else {
        if (outOfRange(ctx, 2)) {
          return RANGE_ERR
        }
        appendU8(ctx, edge.prop)
        appendU8(ctx, edge.typeIndex)
        const err = appendFixedValue(ctx, value, edge)
        if (err) {
          return err
        }
      }
    }
  }
}
