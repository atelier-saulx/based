import { BasedDb, ModifyCtx } from '../../index.js'
import { PropDef, SchemaTypeDef } from '../../server/schema/schema.js'
import { startDrain, flushBuffer } from '../operations.js'
import { setCursor } from './setCursor.js'
import { modify } from './modify.js'
import { ModifyRes, ModifyState } from './ModifyRes.js'
import { RANGE_ERR, UPDATE } from './types.js'
import { appendFixedValue } from './fixed.js'
import {
  checkFilterSubscription,
  checkIdSubscription,
} from '../query/subscription/index.js'

type Payload = Record<string, any>

const appendUpdate = (
  ctx: ModifyCtx,
  def: SchemaTypeDef,
  obj: Payload,
  res: ModifyState,
  overwrite?: boolean,
) => {
  const err = modify(ctx, res, obj, def, UPDATE, def.tree, overwrite)

  if (err) {
    return err
  }

  if (def.updateTs) {
    const updateTs = Date.now()
    for (const prop of def.updateTs) {
      if (ctx.mergeMain) {
        ctx.mergeMain.push(prop, updateTs)
        ctx.mergeMainSize += prop.len + 4
      } else {
        ctx.mergeMain = [prop, updateTs]
        ctx.mergeMainSize = prop.len + 4
      }
    }
  }

  if (ctx.mergeMain) {
    let { mergeMain, mergeMainSize } = ctx
    ctx.mergeMainSize = 0
    ctx.mergeMain = null
    if (ctx.len + 15 + mergeMain.length * 4 > ctx.max) {
      return RANGE_ERR
    }

    setCursor(ctx, def, 0, res.tmpId, UPDATE)
    ctx.buf[ctx.len++] = 5
    ctx.buf[ctx.len++] = mergeMainSize
    ctx.buf[ctx.len++] = mergeMainSize >>>= 8
    ctx.buf[ctx.len++] = mergeMainSize >>>= 8
    ctx.buf[ctx.len++] = mergeMainSize >>>= 8

    for (let i = 0; i < mergeMain.length; i += 2) {
      const t: PropDef = mergeMain[i]
      const v = mergeMain[i + 1]
      let { start, len } = t
      ctx.buf[ctx.len++] = start
      ctx.buf[ctx.len++] = start >>>= 8
      ctx.buf[ctx.len++] = len
      ctx.buf[ctx.len++] = len >>>= 8
      const err = appendFixedValue(ctx, v, t)
      if (err) {
        return err
      }
    }
  }
}

export const update = (
  db: BasedDb,
  type: string,
  id: number,
  obj: Payload,
  overwrite?: boolean,
): ModifyRes => {
  const def = db.schemaTypesParsed[type]
  const ctx = db.modifyCtx
  const pos = ctx.len
  const res = new ModifyState(id, db)
  const err = appendUpdate(ctx, def, obj, res, overwrite)

  if (err) {
    ctx.prefix0 = -1 // force a new cursor
    ctx.len = pos

    if (err === RANGE_ERR) {
      if (pos === 0) {
        throw new Error('out of range')
      }
      flushBuffer(db)
      return update(db, type, id, obj, overwrite)
    }

    res.error = err
    // @ts-ignore
    return res
  }

  if (!db.isDraining) {
    startDrain(db)
  }

  // combine in one q
  checkFilterSubscription(db, def.id)
  checkIdSubscription(db, def.id, id)
  // @ts-ignore
  return res
}
