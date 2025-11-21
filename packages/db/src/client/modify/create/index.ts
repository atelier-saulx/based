import { Ctx } from '../Ctx.js'
import { writeObject } from '../props/object.js'
import { reserve } from '../resize.js'
import {
  FULL_CURSOR_SIZE,
  PROP_CURSOR_SIZE,
  writeMainCursor,
  writeTypeCursor,
} from '../cursor.js'
import { getByPath, writeUint16 } from '@based/utils'
import { writeMainValue } from '../props/main.js'
import { Tmp } from '../Tmp.js'
import { DbClient } from '../../../index.js'
import { schedule } from '../drain.js'
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
import {
  inverseLangMap,
  LangCode,
  langCodesMap,
  type TypeDef,
} from '@based/schema'
import { writeSeparate } from '../props/separate.js'
import { writeString } from '../props/string.js'
import { writeU32, writeU8 } from '../uint.js'
import { getValidSchema, validatePayload } from '../validate.js'
import { handleError } from '../error.js'

// const writeDefaults = (ctx: Ctx) => {
//   if (!ctx.typeDef.hasSeperateDefaults) {
//     return
//   }
//   if (ctx.defaults !== ctx.typeDef.separateDefaults.props.size) {
//     for (const def of ctx.typeDef.separateDefaults.props.values()) {
//       if (ctx.typeDef.separateDefaults.bufferTmp[def.prop] === 0) {
//         writeSeparate(ctx, def, def.default)
//         continue
//       }

//       if (def.type !== 'text') {
//         continue
//       }

//       const buf = ctx.typeDef.separateTextSort.bufferTmp
//       const amount = ctx.typeDef.localeSize + 1
//       const len = amount * ctx.typeDef.separateTextSort.props.length
//       for (const sortDef of ctx.typeDef.separateTextSort.props) {
//         const index = sortDef.prop * amount
//         if (buf[index] === 0) {
//           continue
//         }
//         for (let i = index + 1; i < len + index; i++) {
//           const lang = buf[i] as LangCode
//           if (lang === 0) {
//             continue
//           }
//           const val = def.default[inverseLangMap.get(lang)]
//           if (val !== undefined) {
//             writeString(ctx, def, val, lang)
//           }
//         }
//       }
//     }
//   }
// }

// const writeSortable = (ctx: Ctx) => {
//   if (!ctx.typeDef.hasSeperateSort) {
//     return
//   }
//   if (ctx.sort !== ctx.typeDef.separateSort.size) {
//     reserve(ctx, 3)
//     writeU8(ctx, ADD_EMPTY_SORT)
//     const index = ctx.index
//     ctx.index += 2
//     const start = ctx.index
//     for (const def of ctx.typeDef.separateSort.props) {
//       if (ctx.typeDef.separateSort.bufferTmp[def.prop] === 0) {
//         reserve(ctx, 1)
//         writeU8(ctx, def.prop)
//       }
//     }
//     writeUint16(ctx.array, ctx.index - start, index)
//   }
// }

// const writeSortableText = (ctx: Ctx) => {
//   if (!ctx.typeDef.hasSeperateTextSort) {
//     return
//   }

//   if (ctx.sortText !== ctx.typeDef.separateTextSort.size) {
//     reserve(ctx, 3)
//     writeU8(ctx, ADD_EMPTY_SORT_TEXT)
//     const index = ctx.index
//     ctx.index += 2
//     const start = ctx.index
//     const amount = ctx.typeDef.localeSize + 1
//     const len = amount * ctx.typeDef.separateTextSort.props.length
//     const buf = ctx.typeDef.separateTextSort.bufferTmp
//     for (const def of ctx.typeDef.separateTextSort.props) {
//       const index = def.prop * amount
//       if (buf[index] === 0) {
//         continue
//       }
//       reserve(ctx, 2)
//       writeU8(ctx, def.prop)
//       writeU8(ctx, buf[index])
//       for (let i = index + 1; i < len + index; i++) {
//         const lang = buf[i]
//         if (lang === 0) {
//           continue
//         }
//         reserve(ctx, 1)
//         writeU8(ctx, lang)
//       }
//     }
//     writeUint16(ctx.array, ctx.index - start, index)
//     if (ctx.sortText) {
//       buf.set(ctx.typeDef.separateTextSort.buffer, 0)
//     }
//   }
// }

// const writeCreateTs = (ctx: Ctx, payload: any) => {
//   if (!ctx.typeDef.createTs) {
//     return
//   }
//   let createTs: number
//   for (const prop of ctx.typeDef.createTs) {
//     if (getByPath(payload, prop.path) !== undefined) {
//       continue
//     }
//     createTs ??= Date.now()
//     writeMainValue(ctx, prop, createTs)
//   }
// }

export const writeCreate = (
  ctx: Ctx,
  schema: TypeDef,
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
        // @ts-ignore
        obj[key] = def.hooks.create(val, obj)
      }
    }
  }

  if (schema.hooks?.create) {
    payload = schema.hooks.create(payload) || payload
  }

  // if (ctx.defaults) {
  //   ctx.defaults = 0
  //   schema.separateDefaults?.bufferTmp.fill(0)
  // }

  // if (ctx.sort) {
  //   ctx.sort = 0
  //   schema.separateSort.bufferTmp.set(schema.separateSort.buffer)
  // }

  // if (ctx.sortText) {
  //   ctx.sortText = 0
  //   schema.separateTextSort.bufferTmp.set(schema.separateTextSort.buffer)
  // }

  ctx.typeDef = schema
  ctx.operation = CREATE
  ctx.unsafe = opts?.unsafe
  ctx.locale = (opts?.locale && langCodesMap.get(opts.locale)) || 0
  // TODO: can we remove this (and just init main buffer here?)
  ctx.cursor.main = 0

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
  writeObject(ctx, ctx.typeDef, payload)
  if (ctx.index === index || ctx.typeDef.size === 0) {
    reserve(ctx, PROP_CURSOR_SIZE)
    writeMainCursor(ctx)
  }
  // writeCreateTs(ctx, payload)
  // writeDefaults(ctx)
  // writeSortable(ctx)
  // writeSortableText(ctx)
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
