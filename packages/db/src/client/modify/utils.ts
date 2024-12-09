import { ModifyCtx } from '../../index.js'
import {
  BINARY,
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
import { getBuffer } from './binary.js'
import { ModifyError } from './ModifyRes.js'
import { ModifyErr, RANGE_ERR } from './types.js'

// export const outOfRange = (ctx: ModifyCtx, size: number) => {
//   return ctx.len + size > ctx.max
// }

// export const appendU8 = (ctx: ModifyCtx, u32: number) => {
//   ctx.buf[ctx.len++] = u32
// }

// export const alignU32 = (ctx: ModifyCtx) => {
//   ctx.len = (ctx.len + 3) & ~3
// }

// export const appendU16 = (ctx: ModifyCtx, u16: number) => {
//   ctx.buf[ctx.len++] = u16
//   ctx.buf[ctx.len++] = u16 >>>= 8
// }

// export const appendU32 = (ctx: ModifyCtx, u32: number) => {
//   ctx.buf[ctx.len++] = u32
//   ctx.buf[ctx.len++] = u32 >>>= 8
//   ctx.buf[ctx.len++] = u32 >>>= 8
//   ctx.buf[ctx.len++] = u32 >>>= 8
// }

// export const writeU16 = (ctx: ModifyCtx, u16: number, pos: number) => {
//   ctx.buf[pos++] = u16
//   ctx.buf[pos++] = u16 >>>= 8
// }

// export const writeU32 = (ctx: ModifyCtx, u32: number, pos: number) => {
//   ctx.buf[pos++] = u32
//   ctx.buf[pos++] = u32 >>>= 8
//   ctx.buf[pos++] = u32 >>>= 8
//   ctx.buf[pos++] = u32 >>>= 8
// }

// export const reserveU16 = (ctx: ModifyCtx) => {
//   const len = ctx.len
//   ctx.len = len + 2
//   return len
// }

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
  if (type === BINARY) {
    const buf = getBuffer(val)
    const size = buf.byteLength
    if (ctx.len + size + 1 > ctx.max) {
      return RANGE_ERR
    }
    ctx.buf[ctx.len++] = size
    appendBuf(ctx, val)
  } else if (type === STRING) {
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
    if (ctx.len + size + 1 > ctx.max) {
      return RANGE_ERR
    }
    ctx.buf[ctx.len++] = size
    appendUtf8(ctx, val)
  } else if (type === BOOLEAN) {
    if (ctx.len + 1 > ctx.max) {
      return RANGE_ERR
    }
    if (val === null) {
      ctx.buf[ctx.len++] = 0
    } else if (typeof val === 'boolean') {
      ctx.buf[ctx.len++] = val ? 1 : 0
    } else {
      return new ModifyError(def, val)
    }
  } else if (type === ENUM) {
    if (ctx.len + 1 > ctx.max) {
      return RANGE_ERR
    }
    if (val === null) {
      ctx.buf[ctx.len++] = 1
    } else if (val in def.reverseEnum) {
      ctx.buf[ctx.len++] = def.reverseEnum[val] + 1
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
      if (ctx.len + 8 > ctx.max) {
        return RANGE_ERR
      }
      ctx.len = ctx.buf.writeDoubleLE(val, ctx.len)
    } else if (type === UINT32 || type === INT32) {
      if (ctx.len + 4 > ctx.max) {
        return RANGE_ERR
      }
      ctx.buf[ctx.len++] = val
      ctx.buf[ctx.len++] = val >>>= 8
      ctx.buf[ctx.len++] = val >>>= 8
      ctx.buf[ctx.len++] = val >>>= 8
    } else if (type === INT16 || type === UINT16) {
      if (ctx.len + 2 > ctx.max) {
        return RANGE_ERR
      }
      ctx.buf[ctx.len++] = val
      ctx.buf[ctx.len++] = val >>>= 8
    } else {
      if (ctx.len + 1 > ctx.max) {
        return RANGE_ERR
      }
      ctx.buf[ctx.len++] = val
    }
  }
}
