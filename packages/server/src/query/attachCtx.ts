import { BasedQueryFunctionConfig, Context } from '@based/functions'
import { AttachedCtx } from './types.js'
import { hashObjectNest } from '@based/hash'

export const attachCtxInternal = (
  ctx: { [key: string]: any },
  id: number,
): AttachedCtx => {
  // Super slow but can be optmized later
  const attachCtx: AttachedCtx = {
    ctx,
    id,
    authState: false,
    geo: false,
    fromId: id,
  }
  const x = hashObjectNest(ctx, id)
  attachCtx.id = (x[0] >>> 0) * 4096 + x[1]
  return attachCtx
}

export const attachCtx = (
  config: BasedQueryFunctionConfig['ctx'],
  ctx: Context,
  id: number,
): AttachedCtx => {
  // Super slow but can be optmized later
  const attachCtx: AttachedCtx = {
    ctx: {},
    id,
    authState: false,
    geo: false,
    fromId: id,
  }
  let hasValues = false
  if ('session' in ctx) {
    for (const path of config) {
      const p = path.split('.')
      if (p[0] === 'authState') {
        attachCtx.authState = true
      } else if (p[0] === 'geo') {
        attachCtx.geo = true
      }
      let s = attachCtx.ctx
      let c = ctx.session
      for (let i = 0; i < p.length - 1; i++) {
        const path = p[i]
        if (c !== undefined) {
          c = c[path]
        } else {
          c = undefined
        }
        if (!s[path]) {
          s = s[path] = {}
        } else {
          s = s[path]
        }
      }
      const end = p[p.length - 1]
      if (c !== undefined) {
        c = c[end]
        hasValues = c !== undefined
      }
      s[end] = c
    }
  }
  if (hasValues) {
    const x = hashObjectNest(attachCtx.ctx, id)
    attachCtx.id = (x[0] >>> 0) * 4096 + x[1]
  }
  return attachCtx
}
