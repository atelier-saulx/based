import { ModifyCtx } from '../../index.js'
import {
  BINARY,
  MICRO_BUFFER,
  SchemaTypeDef,
  STRING,
  JSON,
  TEXT,
  ALIAS,
} from '@based/schema/def'
import { inverseLangMap, LangCode } from '@based/schema'
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
import { writeBinary } from './binary.js'
import { writeString } from './string.js'
import { writeText } from './text.js'
import { writeJson } from './json.js'
import { writeAlias } from './alias.js'
import { getByPath } from '@based/utils'

export type CreateObj = Record<string, any>

const appendCreate = (
  ctx: ModifyCtx,
  schema: SchemaTypeDef,
  obj: CreateObj,
  res: ModifyState,
  unsafe: boolean,
): ModifyErr => {
  const len = ctx.len
  let err = modify(ctx, res, obj, schema, CREATE, schema.tree, true, unsafe)
  if (err) {
    return err
  }

  if (ctx.len === len || schema.mainLen === 0) {
    if (ctx.len + SIZE.DEFAULT_CURSOR > ctx.max) {
      return RANGE_ERR
    }
    setCursor(ctx, schema, 0, MICRO_BUFFER, res.tmpId, CREATE)
  }

  if (schema.createTs) {
    const createTs = Date.now()
    for (const prop of schema.createTs) {
      if (getByPath(obj, prop.path) !== undefined) {
        continue
      }
      if (ctx.lastMain === -1) {
        let mainLenU32 = schema.mainLen
        setCursor(ctx, schema, prop.prop, MICRO_BUFFER, res.tmpId, CREATE)
        ctx.buf[ctx.len++] = CREATE
        ctx.buf[ctx.len++] = mainLenU32
        ctx.buf[ctx.len++] = mainLenU32 >>>= 8
        ctx.buf[ctx.len++] = mainLenU32 >>>= 8
        ctx.buf[ctx.len++] = mainLenU32 >>>= 8
        ctx.lastMain = ctx.len
        ctx.buf.set(schema.mainEmpty, ctx.len)
        ctx.len += schema.mainLen
      }
      err = writeFixedValue(
        ctx,
        createTs,
        prop,
        ctx.lastMain + prop.start,
        CREATE,
      )
      if (err) {
        return err
      }
    }
  } else if (ctx.lastMain === -1 && !schema.mainEmptyAllZeroes) {
    // this is there to handle different defaults
    if (ctx.lastMain === -1) {
      let mainLenU32 = schema.mainLen
      setCursor(ctx, schema, 0, MICRO_BUFFER, res.tmpId, CREATE)
      ctx.buf[ctx.len++] = CREATE
      ctx.buf[ctx.len++] = mainLenU32
      ctx.buf[ctx.len++] = mainLenU32 >>>= 8
      ctx.buf[ctx.len++] = mainLenU32 >>>= 8
      ctx.buf[ctx.len++] = mainLenU32 >>>= 8
      ctx.lastMain = ctx.len
      ctx.buf.set(schema.mainEmpty, ctx.len)
      ctx.len += schema.mainLen
    }
    // add text & string here
  }

  if (schema.hasSeperateDefaults) {
    const buf = schema.seperateDefaults.bufferTmp
    // if ctx.hasDefault === -1 means it needs defaults

    if (ctx.hasDefaults !== schema.seperateDefaults.props.size - 1) {
      const id = res.tmpId
      for (const propDef of schema.seperateDefaults.props.values()) {
        const prop = propDef.prop
        const type = propDef.typeIndex
        if (schema.seperateDefaults.bufferTmp[prop] === 0) {
          if (type === BINARY) {
            writeBinary(propDef.default, ctx, schema, propDef, id, CREATE)
          } else if (type === STRING) {
            writeString(0, propDef.default, ctx, schema, propDef, id, CREATE)
          } else if (type === TEXT) {
            writeText(propDef.default, ctx, schema, propDef, res, id, CREATE)
          } else if (type === JSON) {
            writeJson(propDef.default, ctx, schema, propDef, id, CREATE)
          } else if (type === ALIAS) {
            writeAlias(propDef.default, ctx, schema, propDef, id, CREATE)
          }
        } else if (type === TEXT) {
          const buf = schema.seperateTextSort.bufferTmp
          const amount = schema.localeSize + 1
          const len = amount * schema.seperateTextSort.props.length
          for (const { prop } of schema.seperateTextSort.props) {
            const index = prop * amount
            if (buf[index] !== 0) {
              for (let i = index + 1; i < len + index; i++) {
                const lang = buf[i] as LangCode
                if (lang !== 0) {
                  const val = propDef.default[inverseLangMap.get(lang)]
                  if (val !== undefined) {
                    writeString(
                      lang,
                      val,
                      ctx,
                      schema,
                      propDef,
                      res.tmpId,
                      CREATE,
                    )
                  }
                }
              }
            }
          }
        }
      }
    }

    if (ctx.hasDefaults !== -1) {
      buf.fill(0)
    }
    ctx.hasDefaults = -1
  }

  if (schema.hasSeperateSort) {
    // just do it here!
    if (ctx.hasSortField !== schema.seperateSort.size - 1) {
      if (ctx.len + 3 > ctx.max) {
        return RANGE_ERR
      }
      ctx.buf[ctx.len++] = ADD_EMPTY_SORT
      let sizepos = ctx.len
      ctx.len += 2
      for (const { prop } of schema.seperateSort.props) {
        if (schema.seperateSort.bufferTmp[prop] === 0) {
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
      schema.seperateSort.bufferTmp.set(schema.seperateSort.buffer, 0)
    }
    // add test for this
    ctx.hasSortField = -1
  }

  if (schema.hasSeperateTextSort) {
    const buf = schema.seperateTextSort.bufferTmp
    if (ctx.hasSortText !== schema.seperateTextSort.size - 1) {
      if (ctx.len + 3 > ctx.max) {
        return RANGE_ERR
      }
      ctx.buf[ctx.len++] = ADD_EMPTY_SORT_TEXT
      let sizepos = ctx.len
      ctx.len += 2
      const amount = schema.localeSize + 1
      const len = amount * schema.seperateTextSort.props.length
      for (const { prop } of schema.seperateTextSort.props) {
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
      buf.set(schema.seperateTextSort.buffer, 0)
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

  obj = def.hooks?.create?.(obj) || obj

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
