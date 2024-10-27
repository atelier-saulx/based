import { BasedDb, ModCtx } from '../index.js'
import { SchemaTypeDef } from '../schema/schema.js'
import { startDrain, flushBuffer } from '../operations.js'
import { setCursor } from './setCursor.js'
import { modify } from './modify.js'
import { ModifyRes, ModifyState } from './ModifyRes.js'
import { CREATE, ModifyErr, RANGE_ERR } from './types.js'
import { appendU8, reserveU16, writeU16 } from './utils.js'

type Payload = Record<string, any>

const appendCreate = (
  ctx: ModCtx,
  def: SchemaTypeDef,
  obj: Payload,
  res: ModifyState,
): ModifyErr => {
  const id = def.lastId + 1
  const len = ctx.len
  const err = modify(ctx, res, obj, def, CREATE, def.tree, true)

  if (err) {
    return err
  }

  if (ctx.len === len || def.mainLen === 0) {
    if (ctx.len + 10 > ctx.max) {
      return RANGE_ERR
    }
    setCursor(ctx, def, 0, id, CREATE)
  }

  // if touched lets see perf impact here
  if (def.hasStringProp) {
    if (ctx.hasStringField !== def.stringPropsSize - 1) {
      if (ctx.len + 3 > ctx.max) {
        return RANGE_ERR
      }
      appendU8(ctx, 7)
      const sizepos = reserveU16(ctx)
      for (const { prop } of def.stringPropsLoop) {
        if (def.stringPropsCurrent[prop] === 1) {
          if (ctx.len === ctx.max) {
            return RANGE_ERR
          }
          appendU8(ctx, prop)
        }
      }
      writeU16(ctx, ctx.len - sizepos - 2, sizepos)
    }

    if (ctx.hasStringField !== -1) {
      def.stringProps.copy(def.stringPropsCurrent)
    }
  }

  def.lastId = id
  def.total++
}

export const create = (db: BasedDb, type: string, obj: Payload): ModifyRes => {
  const def = db.schemaTypesParsed[type]
  const id = def.lastId + 1
  const res = new ModifyState(id, db)
  const ctx = db.modifyCtx
  const pos = ctx.len
  const err = appendCreate(ctx, def, obj, res)

  if (err) {
    ctx.prefix0 = null // force a new cursor
    ctx.len = pos
    if (err === RANGE_ERR) {
      if (pos > 0) {
        flushBuffer(db)
        return create(db, type, obj)
      }
      throw Error(`Payload exceeds maximum payload size (${ctx.max}b)`)
    } else {
      res.error = err
    }
  } else if (!db.isDraining) {
    startDrain(db)
  }

  // @ts-ignore
  return res
}
