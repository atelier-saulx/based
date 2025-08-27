import { SchemaTypeDef, TEXT } from '@based/schema/def'
import { Ctx } from '../Ctx.js'
import { writeObject } from '../props/object.js'
import { reserve } from '../resize.js'
import {
  FULL_CURSOR_SIZE,
  PROP_CURSOR_SIZE,
  writeMainCursor,
  writeNodeCursor,
  writeTypeCursor,
} from '../cursor.js'
import { getByPath, writeUint16 } from '@based/utils'
import { writeMainBuffer, writeMainValue } from '../props/main.js'
import { Tmp } from '../Tmp.js'
import { DbClient, DbClientHooks } from '../../../index.js'
import { drain, schedule } from '../drain.js'
import {
  ADD_EMPTY_SORT,
  ADD_EMPTY_SORT_TEXT,
  CREATE,
  ModifyOpts,
} from '../types.js'
import { inverseLangMap, LangCode, langCodesMap } from '@based/schema'
import { writeSeparate } from '../props/separate.js'
import { writeString } from '../props/string.js'
import { writeU8 } from '../uint.js'
import { validatePayload } from '../validate.js'
import { handleError } from '../error.js'

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

const writeCreate = (ctx: Ctx, payload: any) => {
  reserve(ctx, FULL_CURSOR_SIZE)
  writeTypeCursor(ctx)
  writeNodeCursor(ctx)
  const index = ctx.index
  writeObject(ctx, ctx.schema.tree, payload)
  if (ctx.index === index || ctx.schema.mainLen === 0) {
    reserve(ctx, PROP_CURSOR_SIZE)
    writeMainCursor(ctx)
  }
  writeCreateTs(ctx, payload)
  if (!ctx.cursor.main && !ctx.schema.mainEmptyAllZeroes) {
    writeMainBuffer(ctx)
  }
  writeDefaults(ctx)
  writeSortable(ctx)
  writeSortableText(ctx)
}

export function create(
  db: DbClient,
  type: string,
  payload: any,
  opts: ModifyOpts,
): Promise<number> {
  const schema = db.schemaTypesParsed[type]
  const ctx = db.modifyCtx

  try {
    validatePayload(payload)

    if (schema.hooks?.create) {
      payload = schema.hooks.create(payload) || payload
    }

    if (payload.id) {
      if (!opts?.unsafe) {
        throw 'Invalid payload. "id" not allowed'
      }
      ctx.id = payload.id
    } else {
      if (!(schema.id in ctx.created)) {
        ctx.created[schema.id] = 0
        ctx.max -= 6
      }
      ctx.id = ctx.created[schema.id] + 1
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
    ctx.overwrite = true
    ctx.locale = opts?.locale && langCodesMap.get(opts.locale)
    ctx.defaults = 0
    ctx.start = ctx.index
    writeCreate(ctx, payload)
    ctx.created[schema.id]++
    const tmp = new Tmp(ctx)
    schedule(db, ctx)
    return tmp
  } catch (e) {
    return handleError(db, ctx, create, arguments, e)
  }
}
