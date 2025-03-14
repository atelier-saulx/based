import { BasedDb, ModifyCtx } from '../../../index.js'
import {
  BINARY,
  MICRO_BUFFER,
  CARDINALITY,
  PropDef,
  PropDefEdge,
  REFERENCE,
  REFERENCES,
  STRING,
} from '@based/schema/def'
import { write } from '../../string.js'
import { writeHllBuf } from '../cardinality.js'
import { getBuffer, writeBinaryRaw } from '../binary.js'
import { ModifyError, ModifyState } from '../ModifyRes.js'
import {
  DECREMENT,
  INCREMENT,
  ModifyErr,
  RANGE_ERR,
  UPDATE,
  UPDATE_PARTIAL,
} from '../types.js'
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
  // mergeEdgeMain: (PropDef | any)[] | null

  let mainFields: (PropDefEdge | any)[]
  let mainSize = 0
  let hasIncr = false

  for (const key in t.edges) {
    // handle if main better
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
              return new ModifyError(edge, value)
            }
            size = buf.byteLength
          }
          if (ctx.len + 7 + size > ctx.max) {
            return RANGE_ERR
          }
          ctx.buf[ctx.len++] = UPDATE
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
            return new ModifyError(edge, value)
          }
          if (ctx.len + 7 + Buffer.byteLength(value) > ctx.max) {
            return RANGE_ERR
          }
          ctx.buf[ctx.len++] = UPDATE
          ctx.buf[ctx.len++] = edge.prop
          ctx.buf[ctx.len++] = STRING
          let size = write(ctx.buf, value, ctx.len + 4, edge.compression === 0)
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
              return new ModifyError(edge, value)
            }
          }
          if (value > 0) {
            ctx.buf[ctx.len++] = UPDATE
            ctx.buf[ctx.len++] = edge.prop
            ctx.buf[ctx.len++] = REFERENCE
            ctx.buf[ctx.len++] = value
            ctx.buf[ctx.len++] = value >>>= 8
            ctx.buf[ctx.len++] = value >>>= 8
            ctx.buf[ctx.len++] = value >>>= 8
          } else {
            return new ModifyError(edge, value)
          }
        } else if (edge.typeIndex === REFERENCES) {
          if (!Array.isArray(value)) {
            return new ModifyError(edge, value)
          }
          let size = value.length * 4
          if (ctx.len + 7 + size > ctx.max) {
            return RANGE_ERR
          }
          ctx.buf[ctx.len++] = UPDATE
          ctx.buf[ctx.len++] = edge.prop
          ctx.buf[ctx.len++] = REFERENCES
          ctx.buf[ctx.len++] = size
          ctx.buf[ctx.len++] = size >>>= 8
          ctx.buf[ctx.len++] = size >>>= 8
          ctx.buf[ctx.len++] = size >>>= 8
          appendRefs(edge, ctx, value)
        } else if (edge.typeIndex === CARDINALITY) {
          if (!Array.isArray(value)) {
            value = [value]
          }
          const len = value.length
          let size = 4 + len * 8
          if (ctx.len + size + 11 > ctx.max) {
            return RANGE_ERR
          }
          ctx.buf[ctx.len++] = edge.prop
          ctx.buf[ctx.len++] = CARDINALITY
          writeHllBuf(value, ctx, t, size)
        }
      } else {
        // if incr / decr
        // do stuff

        // INCREMENT / DECREMENT
        // if (typeof value === 'object' && value !== null) {
        // }
        // hasIncr
        // if total len === 1

        if (t.edgeMainLen == edge.len) {
          if (ctx.len + 7 + edge.len > ctx.max) {
            return RANGE_ERR
          }
          ctx.buf[ctx.len++] = UPDATE
          ctx.buf[ctx.len++] = 0
          ctx.buf[ctx.len++] = MICRO_BUFFER
          const size = edge.len
          let sizeU32 = size
          ctx.buf[ctx.len++] = sizeU32
          ctx.buf[ctx.len++] = sizeU32 >>>= 8
          ctx.buf[ctx.len++] = sizeU32 >>>= 8
          ctx.buf[ctx.len++] = sizeU32 >>>= 8
          const err = appendFixedValue(ctx, value, edge)
          if (err) {
            return err
          }
        } else {
          mainSize += edge.len
          if (!mainFields) {
            mainFields = [edge, value]
          } else {
            const len = mainFields.length
            for (let i = 0; i < len; i += 2) {
              if (edge.start < mainFields[i].start) {
                mainFields.splice(i, 0, edge, value)
                break
              } else if (mainFields[len - i - 2].start < edge.start) {
                mainFields.splice(len - i, 0, edge, value)
                break
              }
            }
          }
        }
      }
    }
  }

  if (mainFields) {
    if (mainSize === t.edgeMainLen) {
      if (ctx.len + 7 + mainSize > ctx.max) {
        return RANGE_ERR
      }
      ctx.buf[ctx.len++] = UPDATE
      ctx.buf[ctx.len++] = 0
      ctx.buf[ctx.len++] = MICRO_BUFFER
      let sizeU32 = mainSize
      ctx.buf[ctx.len++] = sizeU32
      ctx.buf[ctx.len++] = sizeU32 >>>= 8
      ctx.buf[ctx.len++] = sizeU32 >>>= 8
      ctx.buf[ctx.len++] = sizeU32 >>>= 8
      for (let i = 0; i < mainFields.length; i += 2) {
        const edge: PropDefEdge = mainFields[i]
        const err = appendFixedValue(ctx, mainFields[i + 1], edge)
        if (err) {
          return err
        }
      }
    } else {
      // START // START // START // START
      // size = sizeu32 = mainTotal
      // thats the actual thing
      // [size][size][size][size][len][len][start-1][start-1][start-2][start-2][MAIN..len]
      // size - len
      const mainFieldsStartSize = mainFields.length * 2
      if (ctx.len + 7 + mainSize + mainFieldsStartSize > ctx.max) {
        return RANGE_ERR
      }
      ctx.buf[ctx.len++] = UPDATE_PARTIAL
      // Main buffer is always 0
      ctx.buf[ctx.len++] = 0
      ctx.buf[ctx.len++] = MICRO_BUFFER

      let sizeU32 = mainFieldsStartSize + t.edgeMainLen
      ctx.buf[ctx.len++] = sizeU32
      ctx.buf[ctx.len++] = sizeU32 >>>= 8
      ctx.buf[ctx.len++] = sizeU32 >>>= 8
      ctx.buf[ctx.len++] = sizeU32 >>>= 8

      let mainTotal = t.edgeMainLen
      ctx.buf[ctx.len++] = mainTotal
      ctx.buf[ctx.len++] = mainTotal >>>= 8

      // index of start of fields
      const sIndex = ctx.len
      ctx.len += mainFieldsStartSize

      // Add zeroes
      ctx.buf.fill(0, ctx.len, ctx.len + t.edgeMainLen)
      // Keep track of written bytes from append fixed
      let writtenFields = 0
      for (let i = 0; i < mainFields.length; i += 2) {
        const edge: PropDefEdge = mainFields[i]
        const value = mainFields[i + 1]
        const sIndexI = i + sIndex
        let start = edge.start
        ctx.buf[sIndexI] = start
        ctx.buf[sIndexI + 1] = start >>>= 8
        let len = edge.len
        ctx.buf[sIndexI + 2] = len
        ctx.buf[sIndexI + 3] = len >>>= 8

        ctx.len += edge.start
        writtenFields += edge.start + edge.len
        const err = appendFixedValue(ctx, value, edge)
        if (err) {
          return err
        }
      }
      // Correction to reuse append fixed value
      ctx.len += t.edgeMainLen - writtenFields
    }
  }
}
