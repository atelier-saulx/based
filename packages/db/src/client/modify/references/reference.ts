import { ModifyCtx } from '../../../index.js'
import { PropDef, SchemaTypeDef } from '@based/schema/def'
import { ModifyError, ModifyState } from '../ModifyRes.js'
import { setCursor } from '../setCursor.js'
import {
  DELETE,
  ModifyErr,
  ModifyOp,
  RANGE_ERR,
  EDGE_NOINDEX_TMPID,
  NOEDGE_NOINDEX_TMPID,
  EDGE_NOINDEX_REALID,
  NOEDGE_INDEX_REALID,
  CREATE,
} from '../types.js'
import { writeEdges } from './edge.js'
import { dbUpdateFromUpsert, RefModifyOpts } from './references.js'

function writeRef(
  id: number,
  ctx: ModifyCtx,
  schema: SchemaTypeDef,
  def: PropDef,
  parentId: number,
  modifyOp: ModifyOp,
  hasEdges: boolean,
  isTmpId: boolean,
): ModifyErr {
  if (!def.validation(id, def)) {
    return new ModifyError(def, id)
  }

  if (ctx.len + 16 > ctx.max) {
    return RANGE_ERR
  }
  ctx.markNodeDirty(ctx.db.schemaTypesParsed[def.inverseTypeName], id)
  setCursor(ctx, schema, def.prop, def.typeIndex, parentId, modifyOp)
  ctx.buf[ctx.len++] = modifyOp
  if (isTmpId) {
    ctx.buf[ctx.len++] = hasEdges ? EDGE_NOINDEX_TMPID : NOEDGE_NOINDEX_TMPID
  } else {
    ctx.buf[ctx.len++] = hasEdges ? EDGE_NOINDEX_REALID : NOEDGE_INDEX_REALID
  }
  ctx.buf[ctx.len++] = id
  ctx.buf[ctx.len++] = id >>>= 8
  ctx.buf[ctx.len++] = id >>>= 8
  ctx.buf[ctx.len++] = id >>>= 8
}

function singleReferenceEdges(
  ref: RefModifyOpts,
  ctx: ModifyCtx,
  schema: SchemaTypeDef,
  def: PropDef,
  parentId: number,
  modifyOp: ModifyOp,
  processDefaultEdges: boolean,
): ModifyErr {
  let id = ref.id
  let isTmpId: boolean
  if (typeof id !== 'number') {
    if (id instanceof ModifyState) {
      if (id.error) {
        return id.error
      }
      const resolvedId = id.getId()
      if (resolvedId) {
        id = resolvedId
      } else {
        isTmpId = !true
        id = id.tmpId
      }
    }
  }

  // TODO SINGLE REF
  if (id > 0) {
    if (def.edgesSeperateCnt === 0 && def.edgeMainLen === 0) {
      return writeRef(id, ctx, schema, def, parentId, modifyOp, false, isTmpId)
    } else {
      let err = writeRef(
        id,
        ctx,
        schema,
        def,
        parentId,
        modifyOp,
        true,
        isTmpId,
      )
      if (err) {
        return err
      }

      // TODO REMOVE - SEEMS REDUNDANT
      if (ctx.len + 4 > ctx.max) {
        return RANGE_ERR
      }

      let sizepos = ctx.len
      ctx.len += 4
      err = writeEdges(def, ref, ctx)
      if (err) {
        return err
      }
      let size = ctx.len - sizepos
      ctx.buf[sizepos++] = size
      ctx.buf[sizepos++] = size >>>= 8
      ctx.buf[sizepos++] = size >>>= 8
      ctx.buf[sizepos] = size >>>= 8
    }
  }
}

export function writeReference(
  value:
    | number
    | ModifyState
    | { id: number; upsert?: Record<string, any> }
    | {
        id?: number
        upsert: Record<string, any>
      },

  ctx: ModifyCtx,
  schema: SchemaTypeDef,
  def: PropDef,
  res: ModifyState,
  modifyOp: ModifyOp,
): ModifyErr {
  if (value === null) {
    if (ctx.len + 11 > ctx.max) {
      return RANGE_ERR
    }
    setCursor(ctx, schema, def.prop, def.typeIndex, res.tmpId, modifyOp)
    ctx.buf[ctx.len++] = DELETE
    return
  }

  const processDefaultEdges = def.hasDefaultEdges

  if (typeof value === 'number') {
    if (processDefaultEdges) {
      value = { id: value }
    } else {
      return writeRef(
        value,
        ctx,
        schema,
        def,
        res.tmpId,
        modifyOp,
        false,
        false,
      )
    }
  }

  if (value instanceof ModifyState) {
    if (value.error) {
      return value.error
    }
    const id = value.getId()

    if (processDefaultEdges) {
      value = { id: id || value.tmpId }
    } else {
      if (id) {
        return writeRef(id, ctx, schema, def, res.tmpId, modifyOp, false, false)
      }
      return writeRef(
        value.tmpId,
        ctx,
        schema,
        def,
        res.tmpId,
        modifyOp,
        false,
        true,
      )
    }
  }

  if (typeof value === 'object') {
    if (def.edges) {
      return singleReferenceEdges(
        value,
        ctx,
        schema,
        def,
        res.tmpId,
        modifyOp,
        processDefaultEdges,
      )
    } else if (typeof value.id === 'number') {
      return writeRef(
        value.id,
        ctx,
        schema,
        def,
        res.tmpId,
        modifyOp,
        false,
        false,
      )
    } else if (typeof value.upsert === 'object' && value.upsert !== null) {
      dbUpdateFromUpsert(
        ctx,
        schema,
        def,
        res,
        ctx.db.upsert(def.inverseTypeName, value.upsert),
      )
    } else {
      return new ModifyError(def, value)
    }
  } else {
    return new ModifyError(def, value)
  }
}
