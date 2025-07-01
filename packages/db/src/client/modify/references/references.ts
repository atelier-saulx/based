import { ModifyCtx } from '../../../index.js'
import { PropDef, REFERENCES, SchemaTypeDef } from '@based/schema/def'
import { ModifyError, ModifyState } from '../ModifyRes.js'
import { setCursor } from '../setCursor.js'
import {
  DELETE,
  EDGE_INDEX_REALID,
  EDGE_INDEX_TMPID,
  EDGE_NOINDEX_REALID,
  EDGE_NOINDEX_TMPID,
  ModifyErr,
  ModifyOp,
  NOEDGE_INDEX_REALID,
  NOEDGE_INDEX_TMPID,
  NOEDGE_NOINDEX_REALID,
  NOEDGE_NOINDEX_TMPID,
  RANGE_ERR,
  REF_OP,
  REF_OP_OVERWRITE,
  REF_OP_PUT_ADD,
  REF_OP_PUT_OVERWRITE,
  REF_OP_UPDATE,
} from '../types.js'
import { writeEdges } from './edge.js'

export type RefModifyOpts = {
  id?: number | ModifyState
  $index?: number
} & Record<`$${string}`, any>

export type RefModify = ModifyState | RefModifyOpts | number

export type Refs =
  | RefModify[]
  | {
      add?: RefModify[] | RefModify
      delete?: RefModify[] | RefModify
      upsert: RefModify[] | RefModify
    }

export function writeReferences(
  value: any,
  ctx: ModifyCtx,
  schema: SchemaTypeDef,
  def: PropDef,
  res: ModifyState,
  mod: ModifyOp,
): ModifyErr {
  if (typeof value !== 'object') {
    return new ModifyError(def, value)
  }

  if (value === null || (Array.isArray(value) && value.length === 0)) {
    if (ctx.len + 11 > ctx.max) {
      return RANGE_ERR
    }
    setCursor(ctx, schema, def.prop, def.typeIndex, res.tmpId, mod)
    ctx.buf[ctx.len++] = DELETE
    return
  }

  if (Array.isArray(value)) {
    return updateRefs(def, ctx, schema, mod, value, res.tmpId, 0)
  }

  for (const key in value) {
    const val = value[key]
    let err: ModifyErr
    if (!Array.isArray(val)) {
      err = new ModifyError(def, value)
    } else if (key === 'delete') {
      err = deleteRefs(def, ctx, schema, mod, val, res.tmpId)
    } else if (key === 'update') {
      err = updateRefs(def, ctx, schema, mod, val, res.tmpId, 1)
    } else if (key === 'add') {
      err = updateRefs(def, ctx, schema, mod, val, res.tmpId, 1)
    } else if (key === 'upsert') {
      dbUpdateFromUpsert(
        ctx,
        schema,
        def,
        res,
        Promise.all(val.map((val) => ctx.db.upsert(def.inverseTypeName, val))),
      )
    } else {
      err = new ModifyError(def, value)
    }

    if (err) {
      return err
    }
  }
}

export const dbUpdateFromUpsert = (
  ctx: ModifyCtx,
  schema: SchemaTypeDef,
  def: PropDef,
  res: ModifyState,
  promise: Promise<any>,
) => {
  res.promises ??= []
  res.promises.push(
    promise.then((result) => {
      let payload = {}
      let i = 0
      for (; i < def.path.length - 1; i++) {
        payload = payload[def.path[i]] = {}
      }
      payload[def.path[i]] = result
      return ctx.db.update(schema.type, res.getId(), payload)
    }),
  )
}

function deleteRefs(
  def: PropDef,
  ctx: ModifyCtx,
  schema: SchemaTypeDef,
  modifyOp: ModifyOp,
  refs: any[],
  parentId: number,
): ModifyErr {
  let size = 4 * refs.length + 1
  if (ctx.len + 10 + size > ctx.max) {
    return RANGE_ERR
  }
  setCursor(ctx, schema, def.prop, def.typeIndex, parentId, modifyOp)
  ctx.buf[ctx.len++] = modifyOp
  ctx.buf[ctx.len++] = size
  ctx.buf[ctx.len++] = size >>>= 8
  ctx.buf[ctx.len++] = size >>>= 8
  ctx.buf[ctx.len++] = size >>>= 8
  ctx.buf[ctx.len++] = 2
  for (let ref of refs) {
    if (typeof ref === 'number') {
      ctx.buf[ctx.len++] = ref
      ctx.buf[ctx.len++] = ref >>>= 8
      ctx.buf[ctx.len++] = ref >>>= 8
      ctx.buf[ctx.len++] = ref >>>= 8
    } else if (ref instanceof ModifyState) {
      if (ref.error) {
        return ref.error
      }
      ref = ref.tmpId
      ctx.buf[ctx.len++] = ref
      ctx.buf[ctx.len++] = ref >>>= 8
      ctx.buf[ctx.len++] = ref >>>= 8
      ctx.buf[ctx.len++] = ref >>>= 8
    } else {
      return new ModifyError(def, refs)
    }
  }
}

function updateRefs(
  def: PropDef,
  ctx: ModifyCtx,
  schema: SchemaTypeDef,
  mod: ModifyOp,
  refs: any[],
  parentId: number,
  op: REF_OP,
): ModifyErr {
  if (ctx.len + 19 + refs.length * 4 > ctx.max) {
    return RANGE_ERR
  }

  setCursor(ctx, schema, def.prop, def.typeIndex, parentId, mod)

  const initpos = ctx.len
  const nrOrErr = putRefs(def, ctx, mod, refs, op)

  if (nrOrErr) {
    if (typeof nrOrErr === 'number') {
      if (nrOrErr === refs.length) {
        ctx.len = initpos
      } else if (ctx.len + 2 > ctx.max) {
        return RANGE_ERR
      } else {
        ctx.buf[ctx.len++] = 0
        ctx.buf[ctx.len++] = REFERENCES
      }
      return appendRefs(def, ctx, mod, refs, op, nrOrErr)
    }
    return nrOrErr
  }
}

function appendRefs(
  def: PropDef,
  ctx: ModifyCtx,
  modifyOp: ModifyOp,
  refs: any[],
  op: REF_OP,
  remaining: number,
): ModifyErr {
  if (ctx.len + 10 > ctx.max) {
    return RANGE_ERR
  }
  const hasEdges = !!def.edges
  ctx.buf[ctx.len++] = modifyOp
  let i = refs.length - remaining

  let totalpos = ctx.len
  ctx.len += 4
  // if it just did a PUT, it should ADD not overwrite the remaining
  ctx.buf[ctx.len++] = i === 0 ? op : REF_OP_UPDATE
  ctx.buf[ctx.len++] = remaining
  ctx.buf[ctx.len++] = remaining >>>= 8
  ctx.buf[ctx.len++] = remaining >>>= 8
  ctx.buf[ctx.len++] = remaining >>>= 8

  for (; i < refs.length; i++) {
    const ref = refs[i]
    let id: number
    let index: number
    let isTmpId: boolean
    if (typeof ref === 'object') {
      if (ref instanceof ModifyState) {
        if (ref.error) {
          return ref.error
        }
        const resolvedId = ref.getId()
        if (resolvedId) {
          id = resolvedId
        } else {
          id = ref.tmpId
          isTmpId = true
        }
      } else if (ref.id instanceof ModifyState) {
        if (ref.id.error) {
          return ref.id.error
        }
        const resolvedId = ref.id.getId()
        if (resolvedId) {
          id = resolvedId
        } else {
          id = ref.id.tmpId
          isTmpId = true
        }
        index = ref.$index
      } else if (ref.id > 0) {
        id = ref.id
        index = ref.$index
      } else {
        return new ModifyError(def, refs)
      }
    } else if (ref > 0) {
      id = ref
    } else {
      return new ModifyError(def, refs)
    }

    if (!def.validation(id, def)) {
      return new ModifyError(def, refs)
    }

    if (hasEdges && typeof ref === 'object' && !(ref instanceof ModifyState)) {
      if (index === undefined) {
        if (ctx.len + 9 > ctx.max) {
          return RANGE_ERR
        }
        ctx.buf[ctx.len++] = isTmpId ? EDGE_NOINDEX_TMPID : EDGE_NOINDEX_REALID
        ctx.buf[ctx.len++] = id
        ctx.buf[ctx.len++] = id >>>= 8
        ctx.buf[ctx.len++] = id >>>= 8
        ctx.buf[ctx.len++] = id >>>= 8
      } else if (typeof index === 'number') {
        if (ctx.len + 13 > ctx.max) {
          return RANGE_ERR
        }
        ctx.buf[ctx.len++] = isTmpId ? EDGE_INDEX_TMPID : EDGE_INDEX_REALID
        ctx.buf[ctx.len++] = id
        ctx.buf[ctx.len++] = id >>>= 8
        ctx.buf[ctx.len++] = id >>>= 8
        ctx.buf[ctx.len++] = id >>>= 8
        ctx.buf[ctx.len++] = index
        ctx.buf[ctx.len++] = index >>>= 8
        ctx.buf[ctx.len++] = index >>>= 8
        ctx.buf[ctx.len++] = index >>>= 8
      } else {
        return new ModifyError(def, refs)
      }
      let sizepos = ctx.len
      ctx.len += 4
      const err = writeEdges(def, ref, ctx)
      if (err) {
        return err
      }
      let size = ctx.len - sizepos - 4
      ctx.buf[sizepos++] = size
      ctx.buf[sizepos++] = size >>>= 8
      ctx.buf[sizepos++] = size >>>= 8
      ctx.buf[sizepos] = size >>>= 8
    } else if (index === undefined) {
      if (ctx.len + 5 > ctx.max) {
        return RANGE_ERR
      }
      ctx.buf[ctx.len++] = isTmpId
        ? NOEDGE_NOINDEX_TMPID
        : NOEDGE_NOINDEX_REALID
      ctx.buf[ctx.len++] = id
      ctx.buf[ctx.len++] = id >>>= 8
      ctx.buf[ctx.len++] = id >>>= 8
      ctx.buf[ctx.len++] = id >>>= 8
    } else if (typeof index === 'number') {
      if (ctx.len + 9 > ctx.max) {
        return RANGE_ERR
      }
      ctx.buf[ctx.len++] = isTmpId ? NOEDGE_INDEX_TMPID : NOEDGE_INDEX_REALID
      ctx.buf[ctx.len++] = id
      ctx.buf[ctx.len++] = id >>>= 8
      ctx.buf[ctx.len++] = id >>>= 8
      ctx.buf[ctx.len++] = id >>>= 8
      ctx.buf[ctx.len++] = index
      ctx.buf[ctx.len++] = index >>>= 8
      ctx.buf[ctx.len++] = index >>>= 8
      ctx.buf[ctx.len++] = index >>>= 8
    } else {
      return new ModifyError(def, refs)
    }
    ctx.markNodeDirty(ctx.db.schemaTypesParsed[def.inverseTypeName], id)
  }

  let size = ctx.len - totalpos - 4
  ctx.buf[totalpos++] = size
  ctx.buf[totalpos++] = size >>>= 8
  ctx.buf[totalpos++] = size >>>= 8
  ctx.buf[totalpos] = size >>>= 8
}

function putRefs(
  def: PropDef,
  ctx: ModifyCtx,
  modifyOp: ModifyOp,
  refs: any[],
  op: REF_OP,
): number | ModifyError {
  let size = refs.length * 4 + 1

  if (refs.length === 0) {
    return 0
  }

  ctx.buf[ctx.len++] = modifyOp
  ctx.buf[ctx.len++] = size
  ctx.buf[ctx.len++] = size >>>= 8
  ctx.buf[ctx.len++] = size >>>= 8
  ctx.buf[ctx.len++] = size >>>= 8
  ctx.buf[ctx.len++] =
    op === REF_OP_OVERWRITE ? REF_OP_PUT_OVERWRITE : REF_OP_PUT_ADD

  let i = 0
  for (; i < refs.length; i++) {
    let ref = refs[i]
    if (typeof ref === 'number') {
      if (!def.validation(ref, def)) {
        return new ModifyError(def, ref)
      } else {
        ctx.buf[ctx.len++] = ref
        ctx.buf[ctx.len++] = ref >>>= 8
        ctx.buf[ctx.len++] = ref >>>= 8
        ctx.buf[ctx.len++] = ref >>>= 8
      }
    } else if (ref instanceof ModifyState) {
      if (ref.error) {
        return ref.error
      }
      ref = ref.getId()
      if (!ref) {
        break
      }
      if (!def.validation(ref, def)) {
        return new ModifyError(def, ref)
      }
      ctx.buf[ctx.len++] = ref
      ctx.buf[ctx.len++] = ref >>>= 8
      ctx.buf[ctx.len++] = ref >>>= 8
      ctx.buf[ctx.len++] = ref >>>= 8
    } else {
      break
    }
    ctx.markNodeDirty(ctx.db.schemaTypesParsed[def.inverseTypeName], ref)
  }

  return refs.length - i
}
