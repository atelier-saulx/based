import { Ctx } from '../Ctx.js'
import { writeObject } from '../props/object.js'
import { reserve } from '../resize.js'
import {
  FULL_CURSOR_SIZE,
  PROP_CURSOR_SIZE,
  writeMainCursor,
  writeTypeCursor,
} from '../cursor.js'
import { writeMainBuffer, writeMainValue } from '../props/main.js'
import { Tmp } from '../Tmp.js'
import { DbClient } from '../../../index.js'
import { schedule } from '../drain.js'
import { ModifyOpts } from '../types.js'
import { writeSeparate } from '../props/separate.js'
import { writeString } from '../props/string.js'
import { writeU32, writeU8 } from '../uint.js'
import { getValidSchema, validatePayload } from '../validate.js'
import { handleError } from '../error.js'
import {
  LangCode,
  LangCodeEnum,
  LangCodeInverse,
  ModOp,
  PropType,
} from '../../../zigTsExports.js'
import type { SchemaTypeDef } from '../../../schema/index.js'
import { writeUint16 } from '../../../utils/uint8.js'
import { getByPath } from '../../../utils/path.js'

// FIXME text sort
//const writeDefaults = (ctx: Ctx) => {
//  if (!ctx.schema.hasSeperateDefaults) {
//    return
//  }
//  if (ctx.defaults !== ctx.schema.separateDefaults!.props.size) {
//    for (const def of ctx.schema.separateDefaults!.props.values()) {
//      const type = def.typeIndex
//      if (ctx.schema.separateDefaults!.bufferTmp[def.prop] === 0) {
//        writeSeparate(ctx, def, def.default)
//        continue
//      }
//
//      if (type !== PropType.text) {
//        continue
//      }
//
//      const buf = ctx.schema.separateTextSort.bufferTmp
//      const amount = ctx.schema.localeSize + 1
//      const len = amount * ctx.schema.separateTextSort.props.length
//      for (const sortDef of ctx.schema.separateTextSort.props) {
//        const index = sortDef.prop * amount
//        if (buf[index] === 0) {
//          continue
//        }
//        for (let i = index + 1; i < len + index; i++) {
//          const lang = buf[i] as LangCodeEnum
//          if (lang === 0) {
//            continue
//          }
//          const val = def.default[LangCodeInverse[lang]]
//          if (val !== undefined) {
//            writeString(ctx, def, val, lang)
//          }
//        }
//      }
//    }
//  }
//}

const writeSortable = (ctx: Ctx) => {
  if (!ctx.schema.hasSeperateSort) {
    return
  }
  if (ctx.sort !== ctx.schema.separateSort.size) {
    reserve(ctx, 3)
    writeU8(ctx, ModOp.addEmptySort)
    const index = ctx.index
    ctx.index += 2
    const start = ctx.index
    for (const def of ctx.schema.separateSort.props) {
      if (ctx.schema.separateSort.bufferTmp[def.prop] === 0) {
        reserve(ctx, 1)
        writeU8(ctx, def.prop)
      }
    }
    writeUint16(ctx.buf, ctx.index - start, index)
  }
}

const writeSortableText = (ctx: Ctx) => {
  if (!ctx.schema.hasSeperateTextSort) {
    return
  }

  if (ctx.sortText !== ctx.schema.separateTextSort.size) {
    reserve(ctx, 3)
    writeU8(ctx, ModOp.addEmptySortText)
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
    writeUint16(ctx.buf, ctx.index - start, index)
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
  opts?: ModifyOpts,
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
        obj[key!] = def.hooks!.create!(val, obj)
      }
    }
  }

  if (schema.hooks?.create) {
    payload = schema.hooks.create(payload) || payload
  }

  if (ctx.defaults) {
    ctx.defaults = 0
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
  ctx.operation = ModOp.createProp
  ctx.unsafe = opts?.unsafe
  ctx.locale = (opts?.locale && LangCode[opts.locale]) || 0
  // TODO: can we remove this (and just init main buffer here?)
  ctx.cursor.main = undefined

  reserve(ctx, FULL_CURSOR_SIZE)
  writeTypeCursor(ctx)
  if (payload.id) {
    if (ctx.unsafe) {
      writeU8(ctx, ModOp.switchIdCreateUnsafe)
      writeU32(ctx, payload.id)
    } else {
      throw 'Invalid payload. "id" not allowed'
    }
  } else if (schema.capped) {
    writeU8(ctx, ModOp.switchIdCreateRing)
    writeU32(ctx, schema.capped)
  } else {
    writeU8(ctx, ModOp.switchIdCreate)
  }
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
  writeSortable(ctx)
  writeSortableText(ctx)
  while (ctx.index < ctx.start + 5) {
    writeU8(ctx, ModOp.padding)
  }
}

export function create(
  db: DbClient,
  type: string,
  payload: any,
  opts?: ModifyOpts,
): Promise<number> {
  const schema = getValidSchema(db, type)
  const ctx = db.modifyCtx
  ctx.start = ctx.index
  try {
    console.log('payload:', payload)
    writeCreate(ctx, schema, payload, opts)
    console.log('buf:', ctx.buf.subarray(0, ctx.index))
    const tmp = new Tmp(ctx)
    schedule(db, ctx)
    return tmp
  } catch (e) {
    return handleError(db, ctx, create, arguments, e)
  }
}
