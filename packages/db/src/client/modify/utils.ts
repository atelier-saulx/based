import { ModifyCtx } from '../../index.js'
import {
  BOOLEAN,
  ENUM,
  INT16,
  INT32,
  NUMBER,
  PropDef,
  PropDefEdge,
  STRING,
  TIMESTAMP,
  UINT16,
  UINT32,
} from '../../server/schema/types.js'
import { ModifyError } from './ModifyRes.js'
import { ModifyErr, RANGE_ERR } from './types.js'

export const outOfRange = (ctx: ModifyCtx, size: number) => {
  return ctx.len + size > ctx.max
}

export const appendU8 = (ctx: ModifyCtx, u32: number) => {
  ctx.buf[ctx.len++] = u32
}

export const alignU32 = (ctx: ModifyCtx) => {
  ctx.len = (ctx.len + 3) & ~3
}

export const appendU16 = (ctx: ModifyCtx, u16: number) => {
  ctx.buf[ctx.len++] = u16
  ctx.buf[ctx.len++] = u16 >>>= 8
}

export const appendU32 = (ctx: ModifyCtx, u32: number) => {
  ctx.buf[ctx.len++] = u32
  ctx.buf[ctx.len++] = u32 >>>= 8
  ctx.buf[ctx.len++] = u32 >>>= 8
  ctx.buf[ctx.len++] = u32 >>>= 8
}

export const writeU16 = (ctx: ModifyCtx, u16: number, pos: number) => {
  ctx.buf[pos++] = u16
  ctx.buf[pos++] = u16 >>>= 8
}

export const writeU32 = (ctx: ModifyCtx, u32: number, pos: number) => {
  ctx.buf[pos++] = u32
  ctx.buf[pos++] = u32 >>>= 8
  ctx.buf[pos++] = u32 >>>= 8
  ctx.buf[pos++] = u32 >>>= 8
}

export const reserveU16 = (ctx: ModifyCtx) => {
  const len = ctx.len
  ctx.len = len + 2
  return len
}

export const reserveU32 = (ctx: ModifyCtx) => {
  const len = ctx.len
  ctx.len = len + 4
  return len
}

export const appendUtf8 = (ctx: ModifyCtx, str: string) => {
  ctx.len += ctx.buf.write(str, ctx.len, 'utf8')
}

export const appendBuf = (ctx: ModifyCtx, buf: Buffer) => {
  ctx.buf.set(buf, ctx.len)
  ctx.len += buf.byteLength
}

export const appendZeros = (ctx: ModifyCtx, n: number) => {
  const end = ctx.len + n
  ctx.buf.fill(0, ctx.len, end)
  ctx.len = end
}

export const writeFixedValue = (
  ctx: ModifyCtx,
  val: any,
  def: PropDef | PropDefEdge,
  pos: number,
): ModifyErr => {
  const len = ctx.len
  ctx.len = pos
  const res = appendFixedValue(ctx, val, def)
  ctx.len = len
  return res
}

export const appendFixedValue = (
  ctx: ModifyCtx,
  val: any,
  def: PropDef | PropDefEdge,
): ModifyErr => {
  const type = def.typeIndex
  if (type === STRING) {
    if (typeof val !== 'string') {
      if (val !== null) {
        return new ModifyError(def, val)
      }
      val = ''
    }
    const size = Buffer.byteLength(val, 'utf8')
    if (size + 1 > def.len) {
      return new ModifyError(def, val)
    }
    if (outOfRange(ctx, size + 1)) {
      return RANGE_ERR
    }
    appendU8(ctx, size)
    appendUtf8(ctx, val)
  } else if (type === BOOLEAN) {
    if (outOfRange(ctx, 1)) {
      return RANGE_ERR
    }
    if (val === null) {
      appendU8(ctx, 0)
    } else if (typeof val === 'boolean') {
      appendU8(ctx, val ? 1 : 0)
    } else {
      return new ModifyError(def, val)
    }
  } else if (type === ENUM) {
    if (outOfRange(ctx, 1)) {
      return RANGE_ERR
    }
    if (val === null) {
      appendU8(ctx, 1)
    } else if (val in def.reverseEnum) {
      appendU8(ctx, def.reverseEnum[val] + 1)
    } else {
      return new ModifyError(def, val)
    }
  } else {
    if (typeof val !== 'number') {
      if (val !== null) {
        return new ModifyError(def, val)
      }
      val = 0
    }
    if (type === TIMESTAMP || type === NUMBER) {
      if (outOfRange(ctx, 8)) {
        return RANGE_ERR
      }
      ctx.len = ctx.buf.writeDoubleLE(val, ctx.len)
    } else if (type === UINT32 || type === INT32) {
      if (outOfRange(ctx, 4)) {
        return RANGE_ERR
      }
      appendU32(ctx, val)
    } else if (type === INT16 || type === UINT16) {
      if (outOfRange(ctx, 2)) {
        return RANGE_ERR
      }
      appendU16(ctx, val)
    } else {
      if (outOfRange(ctx, 1)) {
        return RANGE_ERR
      }
      appendU8(ctx, val)
    }
  }
}
