import { ModifyCtx } from '../../index.js'
import { PropDef, REFERENCES, SchemaTypeDef } from '../../schema/types.js'
import { ModifyError, ModifyState } from '../ModifyRes.js'
import { setCursor } from '../setCursor.js'
import { DELETE, ModifyErr, ModifyOp, RANGE_ERR } from '../types.js'
import {
  alignU32,
  appendU32,
  appendU8,
  reserveU32,
  writeU32,
} from '../utils.js'
import { writeEdges } from './edge.js'

// export
export type RefModifyOpts = {
  id?: number | ModifyState
  $index?: number
} & Record<`$${string}`, any>

export type RefModify = ModifyState | RefModifyOpts | number

export type Refs =
  | RefModify[]
  | {
      add?: RefModify[] | RefModify
      update?: RefModify[] | RefModify
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

  ctx.types.add(def.inverseTypeId)

  if (value === null) {
    if (ctx.len + 11 > ctx.max) {
      return RANGE_ERR
    }
    setCursor(ctx, schema, def.prop, res.tmpId, mod)
    appendU8(ctx, DELETE)
    return
  }

  if (Array.isArray(value)) {
    return updateRefs(def, ctx, mod, value, schema, res, 0)
  }

  for (const key in value) {
    const val = value[key]
    let err
    if (!Array.isArray(val)) {
      err = new ModifyError(def, value)
    } else if (key === 'delete') {
      err = deleteRefs(def, ctx, mod, val, schema, res)
    } else if (key === 'add') {
      err = updateRefs(def, ctx, mod, val, schema, res, 1)
    } else {
      err = new ModifyError(def, value)
    }
    if (err) {
      return err
    }
  }
}

function deleteRefs(
  def: PropDef,
  ctx: ModifyCtx,
  modifyOp: ModifyOp,
  refs: any[],
  schema: SchemaTypeDef,
  res: ModifyState,
): ModifyErr {
  const size = 4 * refs.length
  if (ctx.len + 10 + 1 + size > ctx.max) {
    return RANGE_ERR
  }

  setCursor(ctx, schema, def.prop, res.tmpId, modifyOp)
  appendU8(ctx, modifyOp)
  appendU32(ctx, size + 1)
  appendU8(ctx, 2)

  for (const ref of refs) {
    if (typeof ref === 'number') {
      appendU32(ctx, ref)
    } else if (ref instanceof ModifyState) {
      if (ref.error) {
        return ref.error
      }
      appendU32(ctx, ref.tmpId)
    } else {
      return new ModifyError(def, refs)
    }
  }
}

function updateRefs(
  def: PropDef,
  ctx: ModifyCtx,
  mod: ModifyOp,
  refs: any[],
  schema: SchemaTypeDef,
  res: ModifyState,
  op: 0 | 1,
): ModifyErr {
  if (ctx.len + 19 + refs.length * 4 > ctx.max) {
    return RANGE_ERR
  }

  setCursor(ctx, schema, def.prop, res.tmpId, mod)

  const initpos = ctx.len
  const nrOrErr = putRefs(ctx, mod, refs, res, op)

  if (nrOrErr) {
    if (typeof nrOrErr === 'number') {
      if (nrOrErr === refs.length) {
        // reset
        ctx.len = initpos
      } else if (ctx.len + 2 > ctx.max) {
        return RANGE_ERR
      } else {
        // continue
        appendU8(ctx, 0)
        appendU8(ctx, REFERENCES)
      }

      return appendRefs(def, ctx, mod, refs, res, op, nrOrErr)
    }
    return nrOrErr
  }
}

function appendRefs(
  def: PropDef,
  ctx: ModifyCtx,
  modifyOp: ModifyOp,
  refs: any[],
  res: ModifyState,
  op: 0 | 1,
  remaining: number,
): ModifyErr {
  if (ctx.len + 10 > ctx.max) {
    return RANGE_ERR
  }
  const hasEdges = !!def.edges
  appendU8(ctx, modifyOp)
  const sizepos = reserveU32(ctx)
  let i = refs.length - remaining
  appendU8(ctx, i === 0 ? op : 1) // if it just did a PUT, it should ADD not overwrite the remaining
  appendU32(ctx, remaining) // ref length

  for (; i < refs.length; i++) {
    const ref = refs[i]
    let id: number
    let index: number

    if (typeof ref === 'object') {
      if (ref instanceof ModifyState) {
        if (ref.error) {
          return ref.error
        }
        id = ref.tmpId
      } else if (ref.id instanceof ModifyState) {
        if (ref.id.error) {
          return ref.id.error
        }
        id = ref.id.tmpId
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

    if (hasEdges) {
      if (index === undefined) {
        if (ctx.len + 9 > ctx.max) {
          return RANGE_ERR
        }
        appendU8(ctx, 1)
        appendU32(ctx, id)
      } else {
        if (ctx.len + 13 > ctx.max) {
          return RANGE_ERR
        }
        appendU8(ctx, 2)
        appendU32(ctx, id)
        appendU32(ctx, index)
      }
      const sizepos = reserveU32(ctx)
      const err = writeEdges(def, ref, ctx, res)
      if (err) {
        return err
      }
      writeU32(ctx, ctx.len - sizepos - 4, sizepos)
    } else if (index === undefined) {
      if (ctx.len + 5 > ctx.max) {
        return RANGE_ERR
      }
      appendU8(ctx, 0)
      appendU32(ctx, id)
    } else if (index >= 0) {
      if (ctx.len + 9 > ctx.max) {
        return RANGE_ERR
      }
      appendU8(ctx, 3)
      appendU32(ctx, id)
      appendU32(ctx, index)
    } else {
      return new ModifyError(def, refs)
    }
  }

  writeU32(ctx, ctx.len - sizepos - 4, sizepos)
}

function putRefs(
  ctx: ModifyCtx,
  modifyOp: ModifyOp,
  refs: any[],
  res: ModifyState,
  op: 0 | 1, // overwrite or add
): number | ModifyError {
  appendU8(ctx, modifyOp)
  appendU32(ctx, refs.length * 4 + 1)
  appendU8(ctx, op === 0 ? 3 : 4)
  alignU32(ctx)

  let i = 0
  for (; i < refs.length; i++) {
    const ref = refs[i]
    if (typeof ref === 'number') {
      appendU32(ctx, ref)
    } else if (ref instanceof ModifyState) {
      if (ref.error) {
        return ref.error
      }
      appendU32(ctx, ref.tmpId)
    } else {
      break
    }
  }

  return refs.length - i
}
