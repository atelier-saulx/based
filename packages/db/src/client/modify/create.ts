import { BasedDb, ModifyCtx } from '../../index.js'
import { SchemaTypeDef } from '../../server/schema/schema.js'
import { startDrain, flushBuffer } from '../operations.js'
import { setCursor } from './setCursor.js'
import { modify } from './modify.js'
import { ModifyRes, ModifyState } from './ModifyRes.js'
import { CREATE, ModifyErr, RANGE_ERR } from './types.js'
import { appendU8, outOfRange, reserveU16, writeU16 } from './utils.js'

type Payload = Record<string, any>

const appendCreate = (
  ctx: ModifyCtx,
  def: SchemaTypeDef,
  obj: Payload,
  res: ModifyState,
  unsafe: boolean,
): ModifyErr => {
  const len = ctx.len
  const err = modify(ctx, res, obj, def, CREATE, def.tree, true, unsafe)

  if (err) {
    return err
  }

  if (ctx.len === len || def.mainLen === 0) {
    if (outOfRange(ctx, 10)) {
      return RANGE_ERR
    }
    setCursor(ctx, def, 0, res.tmpId, CREATE)
  }

  // if touched lets see perf impact here
  if (def.hasStringProp) {
    if (ctx.hasStringField !== def.stringPropsSize - 1) {
      if (outOfRange(ctx, 3)) {
        return RANGE_ERR
      }
      appendU8(ctx, 7)
      const sizepos = reserveU16(ctx)
      for (const { prop } of def.stringPropsLoop) {
        if (def.stringPropsCurrent[prop] === 1) {
          if (outOfRange(ctx, 1)) {
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
}

// let cnt = 100
export const create = (
  db: BasedDb,
  type: string,
  obj: Payload,
  unsafe?: boolean,
): ModifyRes => {
  const def = db.schemaTypesParsed[type]
  let id: number
  if ('id' in obj) {
    if (unsafe) {
      id = obj.id
    } else {
      throw Error('create with "id" is not allowed')
    }
  } else {
    id = def.lastId + 1
  }

  const res = new ModifyState(id, db)
  const ctx = db.modifyCtx
  const pos = ctx.len
  const err = appendCreate(ctx, def, obj, res, unsafe)

  if (err) {
    ctx.prefix0 = null // force a new cursor
    ctx.len = pos
    if (err === RANGE_ERR) {
      flushBuffer(db)
      return create(db, type, obj, unsafe)
    } else {
      res.error = err
    }
  } else if (!db.isDraining) {
    startDrain(db)
  }

  if (id > def.lastId) {
    def.lastId = id
    def.total++
  }

  // @ts-ignore
  return res
}
