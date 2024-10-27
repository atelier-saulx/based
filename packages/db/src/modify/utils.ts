import { ModCtx } from '../index.js'
import {
  BOOLEAN,
  ENUM,
  INT16,
  INT8,
  NUMBER,
  PropDef,
  PropDefEdge,
  STRING,
  TIMESTAMP,
  UINT16,
  UINT8,
} from '../schema/types.js'

export const appendU8 = (ctx: ModCtx, u32: number) => {
  ctx.buf[ctx.len++] = u32
}

export const alignU32 = (ctx: ModCtx) => {
  ctx.len = (ctx.len + 3) & ~3
}

export const appendU32 = (ctx: ModCtx, u32: number) => {
  ctx.buf[ctx.len++] = u32
  ctx.buf[ctx.len++] = u32 >>>= 8
  ctx.buf[ctx.len++] = u32 >>>= 8
  ctx.buf[ctx.len++] = u32 >>>= 8
}

export const writeU32 = (ctx: ModCtx, u32: number, pos: number) => {
  ctx.buf[pos++] = u32
  ctx.buf[pos++] = u32 >>>= 8
  ctx.buf[pos++] = u32 >>>= 8
  ctx.buf[pos++] = u32 >>>= 8
}

export const reserveU32 = (ctx: ModCtx) => {
  const len = ctx.len
  ctx.len = len + 4
  return len
}

export const appendUtf8WithSize = (ctx: ModCtx, str: string) => {
  const size = ctx.buf.write(str, ctx.len + 4, 'utf8')
  appendU32(ctx, size)
  ctx.len += size
}

export const appendBufWithSize = (ctx: ModCtx, buf: Buffer) => {
  const size = buf.byteLength
  appendU32(ctx, size)
  ctx.buf.set(buf, ctx.len)
  ctx.len += size
}

export const appendFixedValue = (
  ctx: ModCtx,
  val: any,
  def: PropDef | PropDefEdge,
): true | void => {
  const type = def.typeIndex
  if (type === STRING) {
    if (typeof val !== 'string') {
      if (val !== null) {
        return true
      }
      val = ''
    }
    const size = ctx.buf.write(val, ctx.len + 1, 'utf8')
    if (size + 1 > def.len) {
      return true
    }
    ctx.buf[ctx.len++] = size
    ctx.len += size
  } else if (type === BOOLEAN) {
    if (val === null) {
      ctx.buf[ctx.len++] = 0
    } else if (typeof val === 'boolean') {
      ctx.buf[ctx.len++] = val ? 1 : 0
    } else {
      return true
    }
  } else if (type === ENUM) {
    if (val === null) {
      ctx.buf[ctx.len++] = 1
    } else if (val in def.reverseEnum) {
      ctx.buf[ctx.len++] = def.reverseEnum[val] + 1
    } else {
      return true
    }
  } else {
    if (typeof val !== 'number') {
      if (val !== null) {
        return true
      }
      val = 0
    }
    if (type === TIMESTAMP || type === NUMBER) {
      ctx.len = ctx.buf.writeDoubleLE(val, ctx.len)
    } else {
      ctx.buf[ctx.len++] = val
      if (type === INT8 || type === UINT8) {
        return
      }
      ctx.buf[ctx.len++] = val >>>= 8
      if (type === INT16 || type === UINT16) {
        return
      }
      ctx.buf[ctx.len++] = val >>>= 8
      ctx.buf[ctx.len++] = val >>>= 8
    }
  }
}
