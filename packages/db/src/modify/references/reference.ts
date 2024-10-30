import { BasedDb } from '../../index.js'
import { SchemaTypeDef, PropDef } from '../../schema/types.js'
import { ModifyError, ModifyState } from '../ModifyRes.js'
import { setCursor } from '../setCursor.js'
import { DELETE, ModifyErr, ModifyOp, RANGE_ERR } from '../types.js'
import { appendU32, appendU8, reserveU32, writeU32 } from '../utils.js'
import { getEdgeSize, writeEdges } from './edge.js'
import { RefModifyOpts } from './references.js'

function writeRef(
  id: number,
  ctx: BasedDb['modifyCtx'],
  schema: SchemaTypeDef,
  def: PropDef,
  res: ModifyState,
  modifyOp: ModifyOp,
  hasEdges: boolean,
): ModifyErr {
  if (ctx.len + 16 > ctx.max) {
    return RANGE_ERR
  }
  ctx.db.markNodeDirty(def.inverseTypeId, id)
  setCursor(ctx, schema, def.prop, res.tmpId, modifyOp)
  appendU8(ctx, modifyOp)
  appendU8(ctx, hasEdges ? 1 : 0)
  appendU32(ctx, id)
}

function singleReferencEdges(
  ref: RefModifyOpts,
  ctx: BasedDb['modifyCtx'],
  schema: SchemaTypeDef,
  def: PropDef,
  res: ModifyState,
  modifyOp: ModifyOp,
): ModifyErr {
  let id = ref.id
  if (typeof id !== 'number') {
    if (id instanceof ModifyState) {
      if (id.error) {
        return id.error
      }
      id = id.tmpId
    }
  }

  if (id > 0) {
    const edgesLen = def.edgesTotalLen || getEdgeSize(def, ref)
    if (edgesLen === 0) {
      return writeRef(id, ctx, schema, def, res, modifyOp, false)
    }
    let err = writeRef(id, ctx, schema, def, res, modifyOp, true)
    if (err) {
      return err
    }
    if (ctx.len + 4 + edgesLen > ctx.max) {
      return RANGE_ERR
    }
    const sizepos = reserveU32(ctx)
    err = writeEdges(def, ref, ctx, res)
    if (err) {
      return err
    }

    writeU32(ctx, ctx.len - sizepos, sizepos)
  } else {
    return new ModifyError(def, ref)
  }
}

export function writeReference(
  value: number | ModifyState,
  ctx: BasedDb['modifyCtx'],
  schema: SchemaTypeDef,
  def: PropDef,
  res: ModifyState,
  modifyOp: ModifyOp,
): ModifyErr {
  ctx.types.add(def.inverseTypeId)
  if (value === null) {
    if (ctx.len + 11 > ctx.max) {
      return RANGE_ERR
    }
    setCursor(ctx, schema, def.prop, res.tmpId, modifyOp)
    appendU8(ctx, DELETE)
  } else if (typeof value === 'number') {
    return writeRef(value, ctx, schema, def, res, modifyOp, false)
  } else if (value instanceof ModifyState) {
    if (value.error) {
      return value.error
    }
    return writeRef(value.tmpId, ctx, schema, def, res, modifyOp, false)
  } else if (def.edges && typeof value === 'object') {
    return singleReferencEdges(value, ctx, schema, def, res, modifyOp)
  } else {
    return new ModifyError(def, value)
  }
}
