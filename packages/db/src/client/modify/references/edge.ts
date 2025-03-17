import { ModifyCtx } from '../../../index.js'
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
import { appendRefs } from './appendRefs.js'

type FieldOp = typeof INCREMENT | typeof DECREMENT | typeof UPDATE

function valueOperation(value: any): FieldOp | 0 {
  if (typeof value === 'object' && value !== null) {
    if (value.increment > 0) {
      return INCREMENT
    } else if (value.increment < 0) {
      return DECREMENT
    }
    return 0
  }
  return UPDATE
}

const EDGE_HEADER_SIZE = 5

export function writeEdges(
  t: PropDef,
  ref: RefModifyOpts,
  ctx: ModifyCtx,
): ModifyErr {
  let mainFields: (PropDefEdge | any | FieldOp)[]
  let mainSize = 0
  let hasIncr = false

  for (const key in t.edges) {
    if (key in ref) {
      const edge = t.edges[key]
      let value = ref[key]
      if (edge.separate === true) {
        if (ctx.len + 2 > ctx.max) {
          return RANGE_ERR
        }
        ctx.buf[ctx.len++] = UPDATE
        ctx.buf[ctx.len++] = edge.prop

        /*
          Seperate fields:

          | Offset  | Field       | Size (bytes)| Description                           |
          |---------|-------------|-------------|---------------------------------------|
          | 0       | modify op   | 1           | Modify operation identifier           |
          | 1       | prop        | 1           | Field identifier                      |
          | 2       | type        | 1           | Indicates MICRO_BUFFER type           |
          | 3       | size        | 4           | Size of the data in bytes             |
          | 7       | data        | Variable    | Content                               |
        */

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
          if (ctx.len + EDGE_HEADER_SIZE + size > ctx.max) {
            return RANGE_ERR
          }
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
          if (ctx.len + EDGE_HEADER_SIZE + Buffer.byteLength(value) > ctx.max) {
            return RANGE_ERR
          }
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
          if (ctx.len + EDGE_HEADER_SIZE + size > ctx.max) {
            return RANGE_ERR
          }
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
          if (ctx.len + size + EDGE_HEADER_SIZE > ctx.max) {
            return RANGE_ERR
          }
          ctx.buf[ctx.len++] = CARDINALITY
          writeHllBuf(value, ctx, t, size)
        }
      } else {
        const op = valueOperation(value)
        if (op === 0) {
          return new ModifyError(edge, value)
        }

        if (op != UPDATE) {
          hasIncr = true
          value = value.increment
        }

        if (!hasIncr && t.edgeMainLen == edge.len) {
          /*
          Full main update:

          | Offset  | Field       | Size (bytes)| Description                           |
          |---------|-------------|-------------|---------------------------------------|
          | 0       | modify op   | 1           | Modify operation identifier           |
          | 1       | prop        | 1           | Field identifier (0)                  |
          | 2       | type        | 1           | Indicates MICRO_BUFFER type           |
          | 3       | mainSize    | 4           | Size of the main data in bytes        |
          | 7       | main buffer | Variable    | Main data content                     |
          */

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
            mainFields = [edge, value, op]
          } else {
            const len = mainFields.length
            for (let i = 0; i < len; i += 3) {
              if (edge.start < mainFields[i].start) {
                mainFields.splice(i, 0, edge, value, op)
                break
              } else if (mainFields[len - i - 3].start < edge.start) {
                mainFields.splice(len - i, 0, edge, value, op)
                break
              }
            }
          }
        }
      }
    }
  }

  if (mainFields) {
    // Single field in main buffer can immediately setup the main buffer
    if (!hasIncr && mainSize === t.edgeMainLen) {
      /*
      Full main update:

      | Offset  | Field       | Size (bytes)| Description                           |
      |---------|-------------|-------------|---------------------------------------|
      | 0       | modify op   | 1           | Modify operation identifier           |
      | 1       | prop        | 1           | Field identifier (0)                  |
      | 2       | type        | 1           | Indicates MICRO_BUFFER type           |
      | 3       | mainSize    | 4           | Size of the main data in bytes        |
      | 7       | main buffer | Variable    | Main data content                     |
      */

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
      for (let i = 0; i < mainFields.length; i += 3) {
        const edge: PropDefEdge = mainFields[i]
        const err = appendFixedValue(ctx, mainFields[i + 1], edge)
        if (err) {
          return err
        }
      }
    } else {
      /*
      Partial main update:

      | Offset  | Field       | Size (bytes)| Description                          |
      |---------|-------------|-------------|--------------------------------------|
      | 0       | modify op   | 1           | Modify operation identifier          |
      | 1       | prop        | 1           | Field identifier (0 in this case)    |
      | 2       | type        | 1           | Indicates MICRO_BUFFER type          |
      | 3       | size        | 4           | Total size of the payload            |
      | 7       | mainSize    | 2           | Length of the main data block        |
      | 9       | start       | 2           | Start position of first section      |
      | 11      | len         | 2           | Length of first section              |
      | 12      | field op    | 1           | Field operation type e.g. INCREMENT  |
      | 13      | propType    | 1           | Prop typeIndex                       |
      | ...     | ...         | ...         | Additional (start, len) pairs        |
      | X       | main        | len         | Actual main content                  |

      ### Notes:
      - The number of `(start, len, operation)` pairs is not explicitly stored 
        but **derived** from the structure.
      - Parsing logic must determine the end of pairs by computing:  
        `Pairs End Offset = (size - mainSize)`  
        Sections are processed until the `MAIN` data block begins.
      */

      const mainFieldsStartSize = mainFields.length * 2

      if (ctx.len + 7 + mainSize + mainFieldsStartSize > ctx.max) {
        return RANGE_ERR
      }
      ctx.buf[ctx.len++] = UPDATE_PARTIAL
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

      // Index of start of fields
      const sIndex = ctx.len
      ctx.len += mainFieldsStartSize

      // Add zeroes
      ctx.buf.fill(0, ctx.len, ctx.len + t.edgeMainLen)

      // Keep track of written bytes from append fixed
      let writtenFields = 0

      // do this different...
      let startMain = ctx.len
      for (let i = 0; i < mainFields.length; i += 3) {
        const edge: PropDefEdge = mainFields[i]
        const value = mainFields[i + 1]
        const op = mainFields[i + 2]
        const sIndexI = i + sIndex
        let start = edge.start
        ctx.buf[sIndexI] = start
        ctx.buf[sIndexI + 1] = start >>>= 8
        let len = edge.len
        ctx.buf[sIndexI + 2] = len
        ctx.buf[sIndexI + 3] = len >>>= 8
        ctx.buf[sIndexI + 4] = op
        ctx.buf[sIndexI + 5] = edge.typeIndex
        ctx.len = startMain + edge.start
        if (edge.start + edge.len > writtenFields) {
          writtenFields = edge.start + edge.len
        }
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
