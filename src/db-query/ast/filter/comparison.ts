import { PropDef } from '../../../schema/defs/index.js'
import {
  FilterOpCompare,
  LangCodeEnum,
  PropType,
} from '../../../zigTsExports.js'
import { Ctx, FilterOpts, Operator } from '../ast.js'
import { createCondition } from './condition.js'
import { fixedComparison } from './fixed.js'
import { isFixedLenString } from './operatorToEnum.js'
import { variableComparison } from './variable.js'
import { writeUint32 } from '../../../utils/uint8.js'

export const comparison = (
  ctx: Ctx,
  prop: PropDef,
  lastProp: number,
  op: Operator,
  val: any,
  lang: LangCodeEnum,
  opts?: FilterOpts,
) => {
  if (!Array.isArray(val)) {
    val = [val]
  }
  if (prop.size > 0 && !isFixedLenString(prop)) {
    if (prop.type === PropType.id) {
      const { condition } = createCondition(
        {
          id: prop.id,
          size: 0,
          start: 0,
          type: PropType.id,
          isEdge: false,
        },
        FilterOpCompare.selectId,
      )
      ctx.query.set(condition, ctx.query.length)
    }
    return fixedComparison(prop, op, val, opts)
  }

  if (prop.type === PropType.cardinality) {
    const { condition } = createCondition(
      {
        id: prop.id,
        size: 0,
        start: 0,
        type: prop.type,
        isEdge: prop.isEdge,
      },
      FilterOpCompare.selectCardinality,
    )
    ctx.query.set(condition, ctx.query.length)
    return fixedComparison(
      {
        ...prop,
        size: 4,
        write: (buf, val, offset) => {
          writeUint32(buf, val, offset)
        },
      } as unknown as PropDef,
      op,
      val,
      opts,
    )
  }

  if (prop.type === PropType.alias) {
    // do shit
    if (prop.type === PropType.alias) {
      const { condition } = createCondition(
        {
          id: prop.id,
          size: 0,
          start: 0,
          type: prop.type,
          isEdge: prop.isEdge, // TODO do we support alias edge? seems useless
        },
        FilterOpCompare.selectAlias,
      )
      ctx.query.set(condition, ctx.query.length)
    }
  }
  return variableComparison(prop, op, val, lang, opts)
}
