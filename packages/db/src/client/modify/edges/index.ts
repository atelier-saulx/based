import { Ctx } from '../Ctx.js'
import { writeSeparateEdge } from './separate.js'
import { writeEdgeHeaderMain, writeEdgeHeaderPartial } from './header.js'
import { writeU16, writeU32 } from '../uint.js'
import { writeFixed } from '../props/fixed.js'
import { writeUint16, writeUint32 } from '@based/utils'
import { reserve } from '../resize.js'
import { PROP_CURSOR_SIZE } from '../cursor.js'
import { ModOp } from '../../../zigTsExports.js'
import type { PropDef, PropDefEdge } from '@based/schema'

const setDefaultEdges = (def: PropDef, val: Record<string, any>) => {
  if (def.hasDefaultEdges) {
    for (const key in def.edges) {
      const edge = def.edges[key]
      if (edge.separate && val[key] === undefined) {
        val[key] = edge.default
      }
    }
  }
}

type EdgeOperation =
  | typeof ModOp.updateProp
  | typeof ModOp.increment
  | typeof ModOp.decrement

export const writeEdges = (
  ctx: Ctx,
  def: PropDef,
  obj: Record<string, any>,
  isSingleRefFix: boolean,
) => {
  const index = ctx.index
  ctx.index += 4
  const start = ctx.index

  let hasIncr = false
  let mainSize = 0
  let mainFields: (PropDefEdge | any | EdgeOperation)[] | undefined
  let operation: EdgeOperation

  setDefaultEdges(def, obj)

  for (const key in obj) {
    let val = obj[key]
    if (key === 'id' || key === '$index' || val === undefined) {
      continue
    }
    const edge = def.edges![key]
    if (!edge) {
      throw [def, obj]
    }
    if (edge.separate) {
      writeSeparateEdge(ctx, edge, val)
      continue
    }

    if (typeof val !== 'object' || val === null) {
      operation = ModOp.updateProp
    } else if (val.increment > 0) {
      operation = ModOp.increment
      hasIncr = true
      val = val.increment
    } else if (val.increment < 0) {
      operation = ModOp.decrement
      hasIncr = true
      val = val.increment
    } else {
      throw [edge, val]
    }

    if (!hasIncr && def.edgeMainLen === edge.len) {
      reserve(ctx, 3 + 4 + edge.len)
      writeEdgeHeaderMain(ctx)
      writeU32(ctx, edge.len)
      writeFixed(ctx, edge, val)
    } else {
      mainSize += edge.len
      if (mainFields) {
        const len = mainFields.length
        for (let i = 0; i < len; i += 3) {
          if (edge.start! < mainFields[i].start) {
            mainFields.splice(i, 0, edge, val, operation)
            break
          } else if (mainFields[len - i - 3].start < edge.start!) {
            mainFields.splice(len - i, 0, edge, val, operation)
            break
          }
        }
      } else {
        mainFields = [edge, val, operation]
      }
    }
  }

  if (mainFields || def.hasDefaultEdges) {
    if (!hasIncr && mainSize === def.edgeMainLen) {
      reserve(ctx, 3 + 4 + mainSize)
      writeEdgeHeaderMain(ctx)
      writeU32(ctx, mainSize)
      for (let i = 0; i < mainFields!.length; i += 3) {
        const edge: PropDefEdge = mainFields![i]
        const val = mainFields![i + 1]
        writeFixed(ctx, edge, val)
      }
    } else {
      mainFields ??= []
      const mainFieldsStartSize = mainFields.length * 2
      reserve(
        ctx,
        PROP_CURSOR_SIZE + 4 + 2 + mainFieldsStartSize + def.edgeMainLen!,
      )
      writeEdgeHeaderPartial(ctx)
      writeU32(ctx, mainFieldsStartSize + def.edgeMainLen!)
      writeU16(ctx, def.edgeMainLen!)
      // Index of start of fields
      const sIndex = ctx.index
      ctx.index += mainFieldsStartSize
      // Add zeroes
      ctx.buf.set(def.edgeMainEmpty!, ctx.index)
      // Keep track of written bytes from append fixed
      let startMain = ctx.index
      for (let i = 0; i < mainFields.length; i += 3) {
        const edge: PropDefEdge = mainFields[i]
        const value = mainFields[i + 1]
        const operation = mainFields[i + 2]
        const sIndexI = i * 2 + sIndex
        writeUint16(ctx.buf, edge.start!, sIndexI)
        writeUint16(ctx.buf, edge.len, sIndexI + 2)
        ctx.buf[sIndexI + 4] = operation
        ctx.buf[sIndexI + 5] = edge.typeIndex
        ctx.index = startMain + edge.start!
        // Add null support (defaults)
        writeFixed(ctx, edge, value)
      }
      // Correction append fixed value writes the len
      ctx.index = startMain + def.edgeMainLen!
    }
  }

  const size = ctx.index - start + (isSingleRefFix ? 4 : 0)
  writeUint32(ctx.buf, size, index)
}
