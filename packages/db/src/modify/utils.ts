import { BasedDb } from '../index.js'

export const append32 = (ctx: BasedDb['modifyCtx'], u32: number) => {
  ctx.buf[ctx.len++] = u32
  ctx.buf[ctx.len++] = u32 >>>= 8
  ctx.buf[ctx.len++] = u32 >>>= 8
  ctx.buf[ctx.len++] = u32 >>>= 8
}

export const write32 = (
  ctx: BasedDb['modifyCtx'],
  u32: number,
  pos: number,
) => {
  ctx.buf[pos++] = u32
  ctx.buf[pos++] = u32 >>>= 8
  ctx.buf[pos++] = u32 >>>= 8
  ctx.buf[pos++] = u32 >>>= 8
}
