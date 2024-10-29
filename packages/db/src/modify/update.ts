import { BasedDb, ModifyCtx } from '../index.js'
import { PropDef, SchemaTypeDef } from '../schema/schema.js'
import { startDrain, flushBuffer } from '../operations.js'
import { setCursor } from './setCursor.js'
import { modify } from './modify.js'
import { ModifyRes, ModifyState } from './ModifyRes.js'
import { RANGE_ERR, UPDATE } from './types.js'
import { appendFixedValue, appendU16, appendU32, appendU8 } from './utils.js'

type Payload = Record<string, any>

const appendUpdate = (
  ctx: ModifyCtx,
  def: SchemaTypeDef,
  obj: Payload,
  res: ModifyState,
  overwrite?: boolean,
) => {
  const err = modify(ctx, res, obj, def, UPDATE, def.tree, overwrite)

  if (ctx.mergeMain) {
    const { mergeMain, mergeMainSize } = ctx
    ctx.mergeMainSize = 0
    ctx.mergeMain = null

    if (err) {
      return err
    }

    if (ctx.len + 10 + 5 + mergeMain.length * 4 > ctx.max) {
      return RANGE_ERR
    }

    setCursor(ctx, def, 0, res.tmpId, UPDATE)
    appendU8(ctx, 5)
    appendU32(ctx, mergeMainSize)

    for (let i = 0; i < mergeMain.length; i += 2) {
      const t: PropDef = mergeMain[i]
      const v = mergeMain[i + 1]
      appendU16(ctx, t.start)
      appendU16(ctx, t.len)
      const err = appendFixedValue(ctx, v, t)
      if (err) {
        return err
      }
    }
  } else if (err) {
    return err
  }
}

// let cnt = 100
export const update = (
  db: BasedDb,
  type: string,
  id: number,
  obj: Payload,
  overwrite?: boolean,
): ModifyRes => {
  const def = db.schemaTypesParsed[type]
  const res = new ModifyState(id, db)
  const ctx = db.modifyCtx
  const pos = ctx.len
  const err = appendUpdate(ctx, def, obj, res, overwrite)

  if (err) {
    ctx.prefix0 = null // force a new cursor
    ctx.len = pos
    if (err === RANGE_ERR) {
      // const { min, len, max } = ctx
      flushBuffer(db)
      update(db, type, id, obj, overwrite)
      // console.log('update - range error', { min, len, max }, db.workers)
      // if (cnt-- === 0) {
      //   process.exit()
      // }
      // return flushBuffer(db, () => update(db, type, id, obj, overwrite))

      // }
      // throw Error(`Payload exceeds maximum payload size (${ctx.max}b)`)
    } else {
      res.error = err
    }
  } else if (!db.isDraining) {
    startDrain(db)
  }

  // @ts-ignore
  return res
}

export { ModifyRes }
