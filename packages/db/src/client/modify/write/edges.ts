import { PropDef, PropDefEdge } from '@based/schema/def'
import { Ctx } from '../Ctx.js'
import { resize } from '../resize.js'
import { UPDATE } from '../types.js'

const setDefaultEdges = (def: PropDef, val: Record<string, any>) => {
  if (def.hasDefaultEdges) {
    for (const key in def.edges) {
      if (
        def.edges[key].separate === true &&
        (!(key in val) || val[key] === undefined)
      ) {
        const edge = def.edges[key]
        val[key] = edge.default
      }
    }
  }
}

const writeSeparateEdge = (ctx: Ctx, edge: PropDefEdge, val: any) => {
  resize(ctx, ctx.index + 2)
  ctx.array[ctx.index] = UPDATE
  ctx.array[ctx.index + 1] = edge.prop
  ctx.index += 2
}

export const writeEdges = (
  ctx: Ctx,
  def: PropDef,
  obj: Record<string, any>,
) => {
  setDefaultEdges(def, obj)
  for (const key in obj) {
    if (key === 'id' || key === '$index') {
      continue
    }
    const edge = def.edges[key]
    if (!edge) {
      throw [def, obj]
    }
    if (edge.separate) {
      writeSeparateEdge(ctx, edge, obj[key])
      continue
    }

    // TODO finish this!!
  }
}
