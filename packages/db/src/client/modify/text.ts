import { LangCode } from '@based/schema'
import { ModifyCtx } from '../../index.js'
import {
  ModifyOp,
  ModifyErr,
  CREATE,
  UPDATE,
  RANGE_ERR,
  DELETE,
  SIZE,
} from './types.js'
import { SchemaTypeDef, PropDef } from '@based/schema/def'
import { writeString } from './string.js'
import { ModifyError, ModifyState } from './ModifyRes.js'
import { setCursor } from './setCursor.js'

export function writeText(
  value:
    | { [k: string]: Parameters<typeof writeString>[1] }
    | Parameters<typeof writeString>[1],
  ctx: ModifyCtx,
  schema: SchemaTypeDef,
  t: PropDef,
  res: ModifyState,
  id: number,
  modifyOp: ModifyOp,
): ModifyErr {
  if (value === null && !res.locale) {
    if (modifyOp === UPDATE) {
      if (ctx.len + SIZE.DEFAULT_CURSOR + 1 > ctx.max) {
        return RANGE_ERR
      }
      setCursor(ctx, schema, t.prop, t.typeIndex, id, modifyOp)
      ctx.buf[ctx.len++] = DELETE
    }
    return
  }

  if ((value && typeof value !== 'object') || value === null || value === '') {
    let locale = res.locale
    if (!locale) {
      // TODO: Add def lang option...
      for (const localeCode of schema.seperateTextSort.localeToIndex.keys()) {
        locale = localeCode
        break
      }
    }

    if (!schema.seperateTextSort.localeToIndex.has(locale)) {
      return new ModifyError(t, locale, 'Invalid locale')
    }

    const err = writeString(
      locale,
      value as string,
      ctx,
      schema,
      t,
      res.tmpId,
      modifyOp,
    )

    if (modifyOp === CREATE) {
      const index = t.prop * (schema.localeSize + 1)
      const langIndex = schema.seperateTextSort.localeToIndex.get(locale)
      schema.seperateTextSort.bufferTmp[index] -= 1
      schema.seperateTextSort.bufferTmp[index + langIndex] = 0
      ctx.hasSortText += 1
      if (schema.hasSeperateDefaults) {
        schema.seperateDefaults.bufferTmp[t.prop] = 1
        ctx.hasDefaults++
      }
    }

    return err
  } else {
    if (modifyOp === CREATE && schema.hasSeperateDefaults) {
      ctx.hasDefaults++
    }

    // @ts-ignore
    for (const lang in value) {
      const langC: Uint8Array =
        schema.seperateTextSort.localeStringToIndex.get(lang)
      if (!langC) {
        return new ModifyError(t, lang, 'Invalid locale')
      }
      let s = value[lang]

      const err = writeString(
        langC[1] as LangCode,
        s,
        ctx,
        schema,
        t,
        res.tmpId,
        modifyOp,
      )
      if (err) {
        return err
      }

      if (modifyOp === CREATE) {
        const index = t.prop * (1 + schema.localeSize)
        schema.seperateTextSort.bufferTmp[index] -= 1
        schema.seperateTextSort.bufferTmp[index + langC[0]] = 0
        ctx.hasSortText += 1
        if (schema.hasSeperateDefaults) {
          schema.seperateDefaults.bufferTmp[t.prop]++
        }
      }
    }
  }
}
