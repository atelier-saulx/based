import { LangCode } from '@based/schema'
import { ENCODER, ModifyCtx } from '../../index.js'
import { SchemaTypeDef, PropDef } from '@based/schema/def'
import {
  CREATE,
  UPDATE,
  ModifyOp,
  ModifyErr,
  RANGE_ERR,
  DELETE,
  SIZE,
  DELETE_TEXT_FIELD,
  MOD_OPS_TO_STRING,
} from './types.js'
import { ModifyError } from './ModifyRes.js'
import { setCursor } from './setCursor.js'
import { write } from '../string.js'

// allow setting buffer in modify create for strings
// add compression handling for main buffer
// add compression handling for edge fields
export function writeString(
  lang: LangCode,
  value: string | null | Uint8Array,
  ctx: ModifyCtx,
  schema: SchemaTypeDef,
  t: PropDef,
  parentId: number,
  modifyOp: ModifyOp,
): ModifyErr {
  const isBuffer = value instanceof Uint8Array

  if (value === null || value === '') {
    if (modifyOp === UPDATE) {
      if (ctx.len + SIZE.DEFAULT_CURSOR + 2 > ctx.max) {
        return RANGE_ERR
      }
      setCursor(ctx, schema, t.prop, t.typeIndex, parentId, modifyOp)
      if (lang === 0) {
        ctx.buf[ctx.len++] = DELETE
      } else {
        ctx.buf[ctx.len++] = DELETE_TEXT_FIELD
        ctx.buf[ctx.len++] = lang
      }
    }
  } else {
    if (!t.validation(value, t)) {
      return new ModifyError(t, value)
    }
    if (t.transform) {
      value = t.transform(MOD_OPS_TO_STRING[modifyOp], value)
    }
    let size = isBuffer
      ? // @ts-ignore
        value.byteLength
      : // @ts-ignore
        ENCODER.encode(value).byteLength + 6
    if (ctx.len + SIZE.DEFAULT_CURSOR + 11 + size > ctx.max) {
      return RANGE_ERR
    }
    if (modifyOp === CREATE) {
      schema.seperateSort.bufferTmp[t.prop] = 2
      ctx.hasSortField++
      if (schema.hasSeperateDefaults) {
        schema.seperateDefaults.bufferTmp[t.prop] = 1
        ctx.hasDefaults++
      }
    }
    setCursor(ctx, schema, t.prop, t.typeIndex, parentId, modifyOp)
    // TODO if buffer check if second byte is zero or one
    // modOp | size u32 | stringprotocol | string
    ctx.buf[ctx.len] = modifyOp
    ctx.len += 5
    if (isBuffer) {
      // @ts-ignore
      ctx.buf.set(value, ctx.len)
    } else {
      const isNoCompression = t.compression === 0
      // @ts-ignore stupid str
      size = write(ctx.buf, value, ctx.len, isNoCompression, lang)
      if (size === null) {
        return RANGE_ERR
      }
    }

    let sizepos = ctx.len + 1 - 5
    ctx.len += size
    ctx.buf[sizepos++] = size
    ctx.buf[sizepos++] = size >>>= 8
    ctx.buf[sizepos++] = size >>>= 8
    ctx.buf[sizepos] = size >>>= 8
  }
}
