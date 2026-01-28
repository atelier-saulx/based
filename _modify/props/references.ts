import type { PropDef } from '../../../schema.js'
import { writeUint32 } from '../../../utils/uint8.js'
import { ModOp, RefOp, type RefOpEnum } from '../../../zigTsExports.js'
import type { Ctx } from '../Ctx.js'
import { PROP_CURSOR_SIZE, writePropCursor } from '../cursor.js'
import { reserve } from '../resize.js'
import { writeU32, writeU8 } from '../uint.js'
import { writeObject } from './object.js'

type Edges = Record<string, any> | undefined
const getEdges = (obj: Record<string, any>): Edges => {
  let edges: Edges
  for (const i in obj) {
    if (i[0] === '$' && i !== '$index') {
      edges ??= {}
      edges[i] = obj[i]
    }
  }
  return edges
}

export const writeReferences = (ctx: Ctx, def: PropDef, val: any) => {
  if (typeof val !== 'object') {
    throw [def, val]
  }

  if (val === null) {
    reserve(ctx, PROP_CURSOR_SIZE + 1)
    writePropCursor(ctx, def)
    writeU8(ctx, ModOp.delete)
    return
  }

  if (Array.isArray(val)) {
    reserve(ctx, PROP_CURSOR_SIZE + 1 + 1 + val.length * 9) // very defensive TODO make exact
    writePropCursor(ctx, def)
    writeU8(ctx, ctx.operation)

    if (ctx.operation === ModOp.updateProp) {
      writeU8(ctx, RefOp.clear)
    }

    let prevOp: RefOpEnum | undefined
    let pos = 0
    let len = 0

    for (const item of val) {
      let id: number
      let op: RefOpEnum
      let edges: Edges
      if (typeof item === 'number') {
        id = item
        op = RefOp.set
      } else if (typeof item === 'object' && item !== null && item.id) {
        id = item.id
        edges = getEdges(item)
        if (edges) {
          op = RefOp.setEdge
        } else {
          op = RefOp.set
        }
      } else {
        // not handled yet
        throw new Error('references payload, not handled yet - wip')
      }

      if (prevOp !== op!) {
        if (prevOp) {
          // write previous len
          writeUint32(ctx.buf, len * 4, pos)
        }
        writeU8(ctx, (prevOp = op!))
        pos = ctx.index
        len = 0
        ctx.index += 4
      }

      writeU32(ctx, id)
      if (edges) {
        writeObject(ctx, def.edges as any, edges)
        writeU8(ctx, ModOp.end)
      }

      len++
    }

    writeUint32(ctx.buf, len, pos)
    writeU8(ctx, RefOp.end)
    return
  }
}
