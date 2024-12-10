import { BasedDb, ModifyCtx } from '../../index.js'
import { SchemaTypeDef } from '../../server/schema/schema.js'
import { startDrain, flushBuffer } from '../operations.js'
import { setCursor } from './setCursor.js'
import { modify } from './modify.js'
import { ModifyRes, ModifyState } from './ModifyRes.js'
import { CREATE, ModifyErr, RANGE_ERR } from './types.js'
// import { BasedDbClient } from '../index.js'

type Payload = Record<string, any>

const appendCreate = (
  ctx: ModifyCtx,
  def: SchemaTypeDef,
  obj: Payload,
  parentId: number,
  unsafe: boolean,
): ModifyErr => {
  const len = ctx.len
  const err = modify(ctx, parentId, obj, def, CREATE, def.tree, true, unsafe)

  if (err) {
    return err
  }

  if (ctx.len === len || def.mainLen === 0) {
    if (ctx.len + 10 > ctx.max) {
      return RANGE_ERR
    }
    setCursor(ctx, def, 0, parentId, CREATE)
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

  const ctx = db.modifyCtx
  const res = new ModifyState(id, db)
  const pos = ctx.len
  const err = appendCreate(ctx, def, obj, id, unsafe)

  if (err) {
    ctx.prefix0 = -1 // force a new cursor
    ctx.len = pos

    if (err === RANGE_ERR) {
      flushBuffer(db)
      return create(db, type, obj, unsafe)
    }

    res.error = err
    // @ts-ignore
    return res
  }

  if (!db.isDraining) {
    startDrain(db)
  }

  if (id > def.lastId) {
    def.lastId = id
    def.total++
  }

  // @ts-ignore
  return res
}
