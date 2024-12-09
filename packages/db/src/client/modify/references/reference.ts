import { BasedDb } from '../../../index.js'
import { PropDef } from '../../../server/schema/types.js'
import { ModifyError, ModifyState } from '../ModifyRes.js'
import { setCursor } from '../setCursor.js'
import { DELETE, ModifyErr, ModifyOp, RANGE_ERR } from '../types.js'
import {
  appendU32,
  appendU8,
  outOfRange,
  reserveU32,
  writeU32,
} from '../utils.js'
import { getEdgeSize, writeEdges } from './edge.js'
import { RefModifyOpts } from './references.js'

function writeRef(
  id: number,
  ctx: BasedDb['modifyCtx'],
  def: PropDef,
  parentId: number,
  modifyOp: ModifyOp,
  hasEdges: boolean,
): ModifyErr {
  if (outOfRange(ctx, 16)) {
    return RANGE_ERR
  }
  ctx.db.markNodeDirty(ctx.db.schemaTypesParsed[def.inverseTypeName], id)
  setCursor(ctx, def.prop, parentId, modifyOp)
  appendU8(ctx, modifyOp)
  appendU8(ctx, hasEdges ? 1 : 0)
  appendU32(ctx, id)
}

function singleReferenceEdges(
  ref: RefModifyOpts,
  ctx: BasedDb['modifyCtx'],
  def: PropDef,
  parentId: number,
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
      return writeRef(id, ctx, def, parentId, modifyOp, false)
    }
    let err = writeRef(id, ctx, def, parentId, modifyOp, true)
    if (err) {
      return err
    }
    if (outOfRange(ctx, 4 + edgesLen)) {
      return RANGE_ERR
    }
    const sizepos = reserveU32(ctx)
    err = writeEdges(def, ref, ctx)
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
  def: PropDef,
  parentId: number,
  modifyOp: ModifyOp,
): ModifyErr {
  if (value === null) {
    if (outOfRange(ctx, 11)) {
      return RANGE_ERR
    }
    setCursor(ctx, def.prop, parentId, modifyOp)
    appendU8(ctx, DELETE)
  } else if (typeof value === 'number') {
    return writeRef(value, ctx, def, parentId, modifyOp, false)
  } else if (value instanceof ModifyState) {
    if (value.error) {
      return value.error
    }
    return writeRef(value.tmpId, ctx, def, parentId, modifyOp, false)
  } else if (def.edges && typeof value === 'object') {
    return singleReferenceEdges(value, ctx, def, parentId, modifyOp)
  } else {
    return new ModifyError(def, value)
  }
}
