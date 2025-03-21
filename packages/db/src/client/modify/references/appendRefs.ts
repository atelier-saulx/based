import { PropDefEdge } from '@based/schema/def'
import { ModifyCtx } from '../../flushModify.js'
import { ModifyState, ModifyError } from '../ModifyRes.js'
import { ModifyErr } from '../types.js'

export function appendRefs(
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
      } else {
        return new ModifyError(t, value)
      }
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
