import { Ctx } from '../Ctx.js'
import { reserve } from '../resize.js'
import { PROP_CURSOR_SIZE, writePropCursor } from '../cursor.js'
import { writeU32, writeU8 } from '../uint.js'
import { Tmp } from '../Tmp.js'
import { validate } from '../validate.js'
import { writeEdges } from '../edges/index.js'
import {
  EDGE_INDEX_REALID,
  EDGE_INDEX_TMPID,
  EDGE_NOINDEX_REALID,
  EDGE_NOINDEX_TMPID,
  NOEDGE_INDEX_REALID,
  NOEDGE_INDEX_TMPID,
  NOEDGE_NOINDEX_REALID,
  NOEDGE_NOINDEX_TMPID,
} from '../types.js'
import { ModOp, RefOp, type RefOpEnum } from '../../../zigTsExports.js'
import type { PropDef } from '../../../schema/index.js'
import { writeUint32 } from '../../../utils/uint8.js'

const clearReferences = (ctx: Ctx, def: PropDef) => {
  reserve(ctx, PROP_CURSOR_SIZE + 1)
  writePropCursor(ctx, def)
  writeU8(ctx, ModOp.delete)
}

const hasEdgeOrIndex = (def: PropDef, obj: Record<string, any>): boolean => {
  if (def.edges) {
    for (const key in obj) {
      if (key[0] === '$') {
        return true
      }
    }
  }
  return false
}

const hasAnEdge = (def: PropDef, obj: Record<string, any>): boolean => {
  if (def.hasDefaultEdges) {
    return true
  }
  if (def.edges) {
    for (const key in obj) {
      if (key[0] === '$' && key !== '$index') {
        return true
      }
    }
  }
  return false
}

const putReferences = (
  ctx: Ctx,
  def: PropDef,
  val: any,
  refOp: RefOpEnum,
): number => {
  reserve(ctx, PROP_CURSOR_SIZE + 6 + val.length * 4)
  writePropCursor(ctx, def)
  writeU8(ctx, ctx.operation)
  writeU32(ctx, val.length * 4 + 1)
  writeU8(ctx, refOp === RefOp.overwrite ? RefOp.putOverwrite : RefOp.putAdd)
  let index = 0
  for (const id of val) {
    if (typeof id === 'number') {
      validate(id, def)
      writeU32(ctx, id)
      index++
      continue
    }
    if (typeof id === 'object' && id !== null && typeof id.id === 'number') {
      if (hasEdgeOrIndex(def, id)) {
        return index
      }
      validate(id.id, def)
      writeU32(ctx, id.id)
      index++
      continue
    }
    return index
  }
  return index
}

const updateReferences = (
  ctx: Ctx,
  def: PropDef,
  val: any[],
  index: number,
  length: number,
  refOp: RefOpEnum,
) => {
  reserve(ctx, PROP_CURSOR_SIZE + 6 + val.length * 9)
  writePropCursor(ctx, def)
  writeU8(ctx, ctx.operation)
  const sizeIndex = ctx.index
  ctx.index += 4
  const start = ctx.index
  writeU8(ctx, index > 0 ? RefOp.add : refOp)
  writeU32(ctx, length)
  while (length--) {
    let id = val[index++]
    if (def.hasDefaultEdges) {
      if (
        typeof id === 'number' ||
        id instanceof Tmp ||
        id instanceof Promise
      ) {
        id = { id: id }
      }
    }

    if (typeof id === 'number') {
      validate(id, def)
      writeU8(ctx, NOEDGE_NOINDEX_REALID)
      writeU32(ctx, id)
      continue
    }
    if (typeof id !== 'object' || id === null) {
      throw [def, val]
    }

    if (typeof id.then === 'function') {
      if (id.id) {
        validate(id.id, def)
        writeU8(ctx, NOEDGE_NOINDEX_REALID)
        writeU32(ctx, id.id)
        continue
      }
      if (id instanceof Tmp && id.batch === ctx.batch) {
        writeU8(ctx, NOEDGE_NOINDEX_TMPID)
        writeU32(ctx, id.tmpId)
        continue
      }
      throw id
    }

    if (typeof id.id === 'number') {
      validate(id.id, def)
      writeReferenceObj(ctx, def, id.id, id, false)
      continue
    }

    if (typeof id.id !== 'object' || id.id === null) {
      throw [def, val]
    }

    if (typeof id.id.then === 'function') {
      if (id.id.id) {
        validate(id.id.id, def)
        writeReferenceObj(ctx, def, id.id.id, id, false)
        continue
      }
      if (id.id instanceof Tmp && id.id.batch === ctx.batch) {
        writeReferenceObj(ctx, def, id.id.tmpId, id, true)
        continue
      }
      throw id.id
    }
  }

  writeUint32(ctx.buf, ctx.index - start, sizeIndex)
}

const putOrUpdateReferences = (
  ctx: Ctx,
  def: PropDef,
  val: any,
  refOp: RefOpEnum,
) => {
  if (!val.length) {
    clearReferences(ctx, def)
    return
  }

  if (def.hasDefaultEdges) {
    updateReferences(ctx, def, val, 0, val.length, refOp)
    return
  }

  const start = ctx.index
  const index = putReferences(ctx, def, val, refOp)
  if (index === val.length) {
    // did all
    return
  }
  if (index === 0) {
    // did nothing
    ctx.index = start
    ctx.cursor.prop = undefined
    updateReferences(ctx, def, val, 0, val.length, refOp)
  } else {
    // did partial
    ctx.cursor.prop = undefined
    updateReferences(ctx, def, val, index, val.length - index, refOp)
  }
}

const writeReferenceObj = (
  ctx: Ctx,
  def: PropDef,
  id: number,
  obj: Record<string, any>,
  isTmp: boolean,
) => {
  const hasIndex = typeof obj.$index === 'number'
  const hasEdges = hasAnEdge(def, obj)
  if (hasIndex) {
    if (hasEdges) {
      writeU8(ctx, isTmp ? EDGE_INDEX_TMPID : EDGE_INDEX_REALID)
      writeU32(ctx, id)
      writeU32(ctx, obj.$index)

      // writeEdges(ctx, def, obj, false)
    } else {
      writeU8(ctx, isTmp ? NOEDGE_INDEX_TMPID : NOEDGE_INDEX_REALID)
      writeU32(ctx, id)
      writeU32(ctx, obj.$index)
    }
  } else if (hasEdges) {
    writeU8(ctx, isTmp ? EDGE_NOINDEX_TMPID : EDGE_NOINDEX_REALID)
    writeU32(ctx, id)
    // writeEdges(ctx, def, obj, false)
  } else {
    writeU8(ctx, isTmp ? NOEDGE_NOINDEX_TMPID : NOEDGE_NOINDEX_REALID)
    writeU32(ctx, id)
  }
}

const deleteReferences = (ctx: Ctx, def: PropDef, val: any[]) => {
  const size = 4 * val.length + 1
  reserve(ctx, PROP_CURSOR_SIZE + 6 + size)
  writePropCursor(ctx, def)
  writeU8(ctx, ctx.operation)
  writeU32(ctx, size)
  writeU8(ctx, RefOp.delete)
  for (const id of val) {
    if (typeof id === 'number') {
      validate(id, def)
      writeU32(ctx, id)
      continue
    }

    if (
      id === null ||
      typeof id !== 'object' ||
      typeof id.then !== 'function'
    ) {
      throw [def, val]
    }

    if (typeof id.id === 'number') {
      writeU32(ctx, id.id)
      continue
    }

    throw id.id || id
  }
}

export const writeReferences = (ctx: Ctx, def: PropDef, val: any) => {
  if (typeof val !== 'object') {
    throw [def, val]
  }

  if (val === null) {
    clearReferences(ctx, def)
    return
  }

  if (Array.isArray(val)) {
    putOrUpdateReferences(ctx, def, val, RefOp.overwrite)
    return
  }

  for (const key in val) {
    const arr = val[key]
    if (!Array.isArray(arr)) {
      throw [def, val]
    }
    if (key === 'update' || key === 'add') {
      putOrUpdateReferences(ctx, def, arr, RefOp.add)
      continue
    }
    if (key === 'delete') {
      deleteReferences(ctx, def, arr)
      continue
    }
    throw [def, val]
  }
}
