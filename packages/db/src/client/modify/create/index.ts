import { SchemaTypeDef, TEXT } from '@based/schema/def'
import { Ctx } from '../Ctx.ts'
import { writeObject } from '../props/object.ts'
import { reserve } from '../resize.ts'
import {
  FULL_CURSOR_SIZE,
  PROP_CURSOR_SIZE,
  writeMainCursor,
  writeTypeCursor,
} from '../cursor.js'
import { getByPath, writeUint16 } from '@based/utils'
import { writeMainBuffer, writeMainValue } from '../props/main.ts'
import { Tmp } from '../Tmp.ts'
import { DbClient } from '../../../index.ts'
import { schedule } from '../drain.ts'
import {
  ADD_EMPTY_SORT,
  ADD_EMPTY_SORT_TEXT,
  CREATE,
  ModifyOpts,
  PADDING,
  SWITCH_ID_CREATE,
  SWITCH_ID_CREATE_RING,
  SWITCH_ID_CREATE_UNSAFE,
} from '../types.js'
import { inverseLangMap, LangCode, langCodesMap } from '@based/schema'
import { writeSeparate } from '../props/separate.ts'
import { writeString } from '../props/string.ts'
import { writeU32, writeU8 } from '../uint.ts'
import { getValidSchema, validatePayload } from '../validate.ts'
import { handleError } from '../error.ts'

const writeDefaults = (ctx: Ctx) => {
  if (!ctx.schema.hasSeperateDefaults) {
    return
  }
  if (ctx.defaults !== ctx.schema.separateDefaults.props.size) {
    for (const def of ctx.schema.separateDefaults.props.values()) {
      const type = def.typeIndex
      if (ctx.schema.separateDefaults.bufferTmp[def.prop] === 0) {
        writeSeparate(ctx, def, def.default)
        continue
      }

      if (type !== TEXT) {
        continue
      }

      const buf = ctx.schema.separateTextSort.bufferTmp
      const amount = ctx.schema.localeSize + 1
      const len = amount * ctx.schema.separateTextSort.props.length
      for (const sortDef of ctx.schema.separateTextSort.props) {
        const index = sortDef.prop * amount
        if (buf[index] === 0) {
          continue
        }
        for (let i = index + 1; i < len + index; i++) {
          const lang = buf[i] as LangCode
          if (lang === 0) {
            continue
          }
          const val = def.default[inverseLangMap.get(lang)]
          if (val !== undefined) {
            writeString(ctx, def, val, lang)
          }
        }
      }
    }
  }
}

const writeSortable = (ctx: Ctx) => {
  if (!ctx.schema.hasSeperateSort) {
    return
  }
  if (ctx.sort !== ctx.schema.separateSort.size) {
    reserve(ctx, 3)
    writeU8(ctx, ADD_EMPTY_SORT)
    const index = ctx.index
    ctx.index += 2
    const start = ctx.index
    for (const def of ctx.schema.separateSort.props) {
      if (ctx.schema.separateSort.bufferTmp[def.prop] === 0) {
        reserve(ctx, 1)
        writeU8(ctx, def.prop)
      }
    }
    writeUint16(ctx.array, ctx.index - start, index)
  }
}

const writeSortableText = (ctx: Ctx) => {
  if (!ctx.schema.hasSeperateTextSort) {
    return
  }

  if (ctx.sortText !== ctx.schema.separateTextSort.size) {
    reserve(ctx, 3)
    writeU8(ctx, ADD_EMPTY_SORT_TEXT)
    const index = ctx.index
    ctx.index += 2
    const start = ctx.index
    const amount = ctx.schema.localeSize + 1
    const len = amount * ctx.schema.separateTextSort.props.length
    const buf = ctx.schema.separateTextSort.bufferTmp
    for (const def of ctx.schema.separateTextSort.props) {
      const index = def.prop * amount
      if (buf[index] === 0) {
        continue
      }
      reserve(ctx, 2)
      writeU8(ctx, def.prop)
      writeU8(ctx, buf[index])
      for (let i = index + 1; i < len + index; i++) {
        const lang = buf[i]
        if (lang === 0) {
          continue
        }
        reserve(ctx, 1)
        writeU8(ctx, lang)
      }
    }
    writeUint16(ctx.array, ctx.index - start, index)
    if (ctx.sortText) {
      buf.set(ctx.schema.separateTextSort.buffer, 0)
    }
  }
}

const writeCreateTs = (ctx: Ctx, payload: any) => {
  if (!ctx.schema.createTs) {
    return
  }
  let createTs: number
  for (const prop of ctx.schema.createTs) {
    if (getByPath(payload, prop.path) !== undefined) {
      continue
    }
    createTs ??= Date.now()
    writeMainValue(ctx, prop, createTs)
  }
}

export const writeCreate = (
  ctx: Ctx,
  schema: SchemaTypeDef,
  payload: any,
  opts: ModifyOpts,
) => {
  validatePayload(payload)

  if (schema.propHooks?.create) {
    for (const def of schema.propHooks.create) {
      let val = payload
      let obj: any
      let key: string
      for (key of def.path) {
        obj = val
        val = val?.[key]
      }
      if (val !== undefined) {
        obj[key] = def.hooks.create(val, obj)
      }
    }
  }

  if (schema.hooks?.create) {
    payload = schema.hooks.create(payload) || payload
  }

  if (ctx.defaults) {
    ctx.defaults = 0
    schema.separateDefaults?.bufferTmp.fill(0)
  }

  if (ctx.sort) {
    ctx.sort = 0
    schema.separateSort.bufferTmp.set(schema.separateSort.buffer)
  }

  if (ctx.sortText) {
    ctx.sortText = 0
    schema.separateTextSort.bufferTmp.set(schema.separateTextSort.buffer)
  }

  ctx.schema = schema
  ctx.operation = CREATE
  ctx.unsafe = opts?.unsafe
  ctx.locale = opts?.locale && langCodesMap.get(opts.locale)
  // TODO: can we remove this (and just init main buffer here?)
  ctx.cursor.main = null

  reserve(ctx, FULL_CURSOR_SIZE)
  writeTypeCursor(ctx)
  if (payload.id) {
    if (ctx.unsafe) {
      writeU8(ctx, SWITCH_ID_CREATE_UNSAFE)
      writeU32(ctx, payload.id)
    } else {
      throw 'Invalid payload. "id" not allowed'
    }
  } else if (schema.capped) {
    writeU8(ctx, SWITCH_ID_CREATE_RING)
    writeU32(ctx, schema.capped)
  } else {
    writeU8(ctx, SWITCH_ID_CREATE)
  }
  const index = ctx.index
  writeObject(ctx, ctx.schema.tree, payload)
  if (ctx.index === index || ctx.schema.mainLen === 0) {
    reserve(ctx, PROP_CURSOR_SIZE)
    writeMainCursor(ctx)
  }
  writeCreateTs(ctx, payload)
  writeDefaults(ctx)
  writeSortable(ctx)
  writeSortableText(ctx)
  while (ctx.index < ctx.start + 5) {
    writeU8(ctx, PADDING)
  }
}

export function create(
  db: DbClient,
  type: string,
  payload: any,
  opts: ModifyOpts,
): Promise<number> {
  const schema = getValidSchema(db, type)
  const ctx = db.modifyCtx
  ctx.start = ctx.index
  try {
    writeCreate(ctx, schema, payload, opts)
    const tmp = new Tmp(ctx)
    schedule(db, ctx)
    return tmp
  } catch (e) {
    return handleError(db, ctx, create, arguments, e)
  }
}
