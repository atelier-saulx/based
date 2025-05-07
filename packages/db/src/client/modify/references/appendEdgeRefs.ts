import type { PropDefEdge } from '@based/schema/def'
import type { ModifyCtx } from '../../flushModify.js'
import type { ModifyErr } from '../types.js'
import { ModifyError, ModifyState } from '../ModifyRes.js'

export function appendEdgeRefs(
  t: PropDefEdge,
  ctx: ModifyCtx,
  value: any[],
): ModifyErr {
  for (let i = 0; i < value.length; i++) {
    let id = value[i]
    if (typeof id !== 'number') {
      if (id instanceof ModifyState) {
        if (id.error) {
          return id.error
        }
        id = id.tmpId
      } else if (typeof id === 'object' && id !== null && id.id) {
        id = id.id
      } else {
        return new ModifyError(t, value)
      }
    }
    if (!t.validation(id, t)) {
      return new ModifyError(t, value)
    }
    if (id > 0) {
      ctx.buf[ctx.len++] = id
      ctx.buf[ctx.len++] = id >>>= 8
      ctx.buf[ctx.len++] = id >>>= 8
      ctx.buf[ctx.len++] = id >>>= 8
    } else {
      return new ModifyError(t, value)
    }
  }
}
