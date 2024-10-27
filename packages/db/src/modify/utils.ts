import { ModCtx } from '../index.js'

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

let sizepos, sizeinit
export const reserveSizeU32 = (ctx: ModCtx) => {
  sizepos = ctx.len
  sizeinit = ctx.len += 4
}

export const commitReservedSizeU32 = (ctx: ModCtx) => {
  let size = ctx.len - sizeinit
  ctx.buf[sizepos++] = size
  ctx.buf[sizepos++] = size >>>= 8
  ctx.buf[sizepos++] = size >>>= 8
  ctx.buf[sizepos++] = size >>>= 8
}
