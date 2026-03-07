import { PropDef } from '../../../schema/defs/index.js'
import { LangCodeEnum } from '../../../zigTsExports.js'
import { FilterOpts, Operator } from '../ast.js'
import { fixedComparison } from './fixed.js'
import { isFixedLenString } from './operatorToEnum.js'
import { variableComparison } from './variable.js'

export const comparison = (
  prop: PropDef,
  op: Operator,
  val: any,
  lang: LangCodeEnum,
  opts?: FilterOpts,
) => {
  if (!Array.isArray(val)) {
    val = [val]
  }
  if (prop.size > 0 && !isFixedLenString(prop)) {
    return fixedComparison(prop, op, val, opts)
  }
  return variableComparison(prop, op, val, lang, opts)
}
