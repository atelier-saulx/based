import { ModifyCtx } from '../../index.js'
import { MICRO_BUFFER, SchemaTypeDef } from '@based/schema/def'
import { startDrain, flushBuffer } from '../flushModify.js'
import { setCursor } from './setCursor.js'
import { modify } from './modify.js'
import { ModifyRes, ModifyState } from './ModifyRes.js'
import {
  CREATE,
  ModifyErr,
  RANGE_ERR,
  ModifyOpts,
  ADD_EMPTY_SORT,
  ADD_EMPTY_SORT_TEXT,
  SIZE,
} from './types.js'
import { writeFixedValue } from './fixed.js'
import { DbClient } from '../index.js'

export type CreateObj = Record<string, any>

const appendCreate = (
  ctx: ModifyCtx,
  def: SchemaTypeDef,
  obj: CreateObj,
  res: ModifyState,
  unsafe: boolean,
): ModifyErr => {
  const len = ctx.len

  let err = modify(ctx, res, obj, def, CREATE, def.tree, true, unsafe)
  if (err) {
    return err
  }

  if (ctx.len === len || def.mainLen === 0) {
    if (ctx.len + SIZE.DEFAULT_CURSOR > ctx.max) {
      return RANGE_ERR
    }
    setCursor(ctx, def, 0, MICRO_BUFFER, res.tmpId, CREATE)
  }

  if (def.createTs) {
    const createTs = Date.now()
    for (const prop of def.createTs) {
      if (ctx.lastMain === -1) {
        let mainLenU32 = def.mainLen
        setCursor(ctx, def, prop.prop, MICRO_BUFFER, res.tmpId, CREATE)
        ctx.buf[ctx.len++] = CREATE
        ctx.buf[ctx.len++] = mainLenU32
        ctx.buf[ctx.len++] = mainLenU32 >>>= 8
        ctx.buf[ctx.len++] = mainLenU32 >>>= 8
        ctx.buf[ctx.len++] = mainLenU32 >>>= 8
        ctx.lastMain = ctx.len
        ctx.buf.set(def.mainEmpty, ctx.len)
        ctx.len += def.mainLen
      }
      err = writeFixedValue(ctx, createTs, prop, ctx.lastMain + prop.start)
      if (err) {
        return err
      }
    }
  } else if (ctx.lastMain === -1 && !def.mainEmptyAllZeroes) {
    // this is there to handle different defaults
    if (ctx.lastMain === -1) {
      let mainLenU32 = def.mainLen
      setCursor(ctx, def, 0, MICRO_BUFFER, res.tmpId, CREATE)
      ctx.buf[ctx.len++] = CREATE
      ctx.buf[ctx.len++] = mainLenU32
      ctx.buf[ctx.len++] = mainLenU32 >>>= 8
      ctx.buf[ctx.len++] = mainLenU32 >>>= 8
      ctx.buf[ctx.len++] = mainLenU32 >>>= 8
      ctx.lastMain = ctx.len
      ctx.buf.set(def.mainEmpty, ctx.len)
      ctx.len += def.mainLen
    }
    // add text & string here
  }

  if (def.hasSeperateSort) {
    if (ctx.hasSortField !== def.seperateSort.size - 1) {
      if (ctx.len + 3 > ctx.max) {
        return RANGE_ERR
      }
      ctx.buf[ctx.len++] = ADD_EMPTY_SORT
      let sizepos = ctx.len
      ctx.len += 2
      for (const { prop } of def.seperateSort.props) {
        if (def.seperateSort.bufferTmp[prop] === 0) {
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

    if (ctx.hasSortField !== -1) {
      def.seperateSort.bufferTmp.set(def.seperateSort.buffer, 0)
    }
    // add test for this
    ctx.hasSortField = -1
  }

  // if (def.hasSeperateDefaults) {
  //   const buf = def.seperateDefaults.bufferTmp

  //   if (ctx.hasDefaults !== def.seperateDefaults.props.size - 1) {
  //     //
  //   }

  //   if (ctx.hasDefaults !== -1) {
  //     buf.set(def.seperateTextSort.buffer, 0)
  //   }
  //   ctx.hasDefaults = -1
  // }

  if (def.hasSeperateTextSort) {
    const buf = def.seperateTextSort.bufferTmp
    if (ctx.hasSortText !== def.seperateTextSort.size - 1) {
      if (ctx.len + 3 > ctx.max) {
        return RANGE_ERR
      }
      ctx.buf[ctx.len++] = ADD_EMPTY_SORT_TEXT
      let sizepos = ctx.len
      ctx.len += 2
      const amount = def.localeSize + 1
      const len = amount * def.seperateTextSort.props.length
      for (const { prop } of def.seperateTextSort.props) {
        const index = prop * amount
        if (buf[index] !== 0) {
          ctx.buf[ctx.len++] = prop
          ctx.buf[ctx.len++] = buf[index]
          for (let i = index + 1; i < len + index; i++) {
            const lang = buf[i]
            if (lang !== 0) {
              ctx.buf[ctx.len++] = lang
            }
          }
        }
      }
      let size = ctx.len - sizepos - 2
      ctx.buf[sizepos++] = size
      ctx.buf[sizepos] = size >>>= 8
      // [size][size] [prop][len][lang][lang]
    }

    if (ctx.hasSortText !== -1) {
      buf.set(def.seperateTextSort.buffer, 0)
    }
    ctx.hasSortText = -1
  }
}

export function create(
  db: DbClient,
  type: string,
  obj: CreateObj,
  opts?: ModifyOpts,
): ModifyRes {
  const def = db.schemaTypesParsed[type]

  if (!def) {
    throw new Error(
      // fix this with promise
      `Unknown type: ${type}. Did you mean on of: ${Object.keys(db.schemaTypesParsed).join(', ')}`,
    )
  }

  let id: number
  if ('id' in obj) {
    if (opts?.unsafe) {
      id = obj.id
    } else {
      // fix this with promise
      throw Error('create with "id" is not allowed')
    }
  } else {
    id = def.lastId + 1
  }

  const ctx = db.modifyCtx
  const res = new ModifyState(def.id, id, db, opts)
  const pos = ctx.len
  const err = appendCreate(ctx, def, obj, res, opts?.unsafe)

  if (err) {
    ctx.prefix0 = -1 // Force a new cursor
    ctx.len = pos
    if (err === RANGE_ERR) {
      if (pos === 8) {
        throw new Error('!No range available')
      }
      void flushBuffer(db)
      return db.create(type, obj, opts)
    }
    res.error = err
    throw err
  }

  ctx.markTypeDirty(def)
  ctx.markNodeDirty(def, id)

  if (!db.isDraining) {
    startDrain(db)
  }

  if (id > def.lastId) {
    def.lastId = id
  }

  // @ts-ignore
  return res
}
