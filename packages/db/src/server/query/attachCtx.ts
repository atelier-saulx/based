import { AttachedCtx } from './types.js'
import { BasedServer } from '../server.js'
import type { BasedRoute, Context } from '../../functions/index.js'
import { hashObjectNest } from '../../hash/index.js'

export const optimizeConfig = (route: BasedRoute<'query'>) => {
  const optimizedCtx: string[][] = []
  for (const key of route.ctx!) {
    optimizedCtx.push(key.split('.'))
  }
  // @ts-ignore
  route._optmizedCtx = optimizedCtx
}

export const attachCtxInternal = (
  route: BasedRoute<'query'>,
  ctx: { [key: string]: any },
  id: number,
): AttachedCtx => {
  // @ts-ignore
  if (!route._optmizedCtx) {
    optimizeConfig(route)
  }
  // @ts-ignore
  const config = route._optmizedCtx

  // Super slow but can be optmized later
  const attachCtx: AttachedCtx = {
    ctx: {},
    id,
    authState: false,
    fromId: id,
  }
  let hasValues = false
  for (const p of config) {
    let s = attachCtx.ctx
    let c: any = ctx
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
  if (hasValues) {
    const x = hashObjectNest(attachCtx.ctx, id)
    attachCtx.id = (x[0] >>> 0) * 4096 + x[1]
  }
  return attachCtx
}

export const attachCtx = (
  // serverClient
  server: BasedServer,
  route: BasedRoute<'query'>,
  ctx: Context,
  id: number,
): AttachedCtx => {
  // @ts-ignore
  if (!route._optmizedCtx) {
    optimizeConfig(route)
  }
  // @ts-ignore
  const config = route._optmizedCtx
  // Super slow but can be optmized later
  const attachCtx: AttachedCtx = {
    ctx: {},
    id,
    authState: false,
    fromId: id,
  }

  let hasValues = false
  if ('session' in ctx) {
    for (const p of config) {
      let c: any = ctx.session
      let i = 0
      if (p[0] === 'authState') {
        attachCtx.authState = true
      } else if (p[0] === 'geo') {
        c = { geo: server.geo(ctx) }
      }
      let s = attachCtx.ctx
      for (; i < p.length - 1; i++) {
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
