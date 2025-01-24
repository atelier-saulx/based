import { BasedDb, ModifyCtx } from '../../index.js'
import { SchemaTypeDef } from '../../server/schema/schema.js'
import { startDrain, flushBuffer } from '../operations.js'
import { setCursor } from './setCursor.js'
import { modify } from './modify.js'
import { ModifyRes, ModifyState } from './ModifyRes.js'
import { CREATE, ModifyErr, RANGE_ERR } from './types.js'
import { writeFixedValue } from './fixed.js'
import { checkFilterSubscription } from '../query/subscription/index.js'

type Payload = Record<string, any>

const appendCreate = (
  ctx: ModifyCtx,
  def: SchemaTypeDef,
  obj: Payload,
  res: ModifyState,
  unsafe: boolean,
): ModifyErr => {
  const len = ctx.len
  let err = modify(ctx, res, obj, def, CREATE, def.tree, true, unsafe)

  if (err) {
    return err
  }

  if (ctx.len === len || def.mainLen === 0) {
    if (ctx.len + 10 > ctx.max) {
      return RANGE_ERR
    }
    setCursor(ctx, def, 0, res.tmpId, CREATE)
  }

  if (def.createTs) {
    const createTs = Date.now()
    for (const prop of def.createTs) {
      if (ctx.lastMain === -1) {
        let mainLenU32 = def.mainLen
        setCursor(ctx, def, prop.prop, res.tmpId, CREATE)
        ctx.buf[ctx.len++] = CREATE
        ctx.buf[ctx.len++] = mainLenU32
        ctx.buf[ctx.len++] = mainLenU32 >>>= 8
        ctx.buf[ctx.len++] = mainLenU32 >>>= 8
        ctx.buf[ctx.len++] = mainLenU32 >>>= 8
        ctx.lastMain = ctx.len
        ctx.buf.fill(0, ctx.len, (ctx.len += def.mainLen))
      }
      err = writeFixedValue(ctx, createTs, prop, ctx.lastMain + prop.start)
      if (err) {
        return err
      }
    }
  }

  // if touched lets see perf impact here
  if (def.hasStringProp) {
    if (ctx.hasStringField !== def.stringPropsSize - 1) {
      if (ctx.len + 3 > ctx.max) {
        return RANGE_ERR
      }
      ctx.buf[ctx.len++] = 7
      let sizepos = ctx.len
      ctx.len += 2
      for (const { prop } of def.stringPropsLoop) {
        if (def.stringPropsCurrent[prop] === 1) {
          if (ctx.len + 1 > ctx.max) {
            return RANGE_ERR
          }
          ctx.buf[ctx.len++] = prop
        }
      }
      let size = ctx.len - sizepos - 2
      ctx.buf[sizepos++] = size
      ctx.buf[sizepos] = size >>>= 8
    }

    if (ctx.hasStringField !== -1) {
      def.stringProps.copy(def.stringPropsCurrent)
    }
  }
}

export function create(
  this: BasedDb,
  type: string,
  obj: Payload,
  unsafe?: boolean,
): ModifyRes {
  const def = this.schemaTypesParsed[type]


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

  const ctx = this.modifyCtx
  const res = new ModifyState(id, this)
  const pos = ctx.len
  const err = appendCreate(ctx, def, obj, res, unsafe)

  if (err) {
    ctx.prefix0 = -1 // force a new cursor
    ctx.len = pos

    if (err === RANGE_ERR) {
      if (pos === 0) {
        throw new Error('out of range')
      }
      flushBuffer(this)
      return this.create(type, obj, unsafe)
    }

    res.error = err
    // @ts-ignore
    return res
  }

  if (!this.isDraining) {
    startDrain(this)
  }

  if (id > def.lastId) {
    def.lastId = id
    def.total++
  }

  checkFilterSubscription(this, def.id)

  // @ts-ignore
  return res
}
