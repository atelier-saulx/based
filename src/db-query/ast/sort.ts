import { PropDef, TypeDef } from '../../schema/defs/index.js'
import { LangCode, Order } from '../../zigTsExports.js'
import { Ctx, QueryAst } from './ast.js'

export const sort = (
  ast: QueryAst,
  ctx: Ctx,
  typeDef: TypeDef,
  fromProp?: PropDef,
) => {
  const field = ast.sort!.prop

  if (field[0] === '$') {
    const prop = fromProp?.edges?.props.get(field)
    if (!prop) {
      throw new Error(`Cannot find edge prop in sort ${ast.sort!.prop}`)
    }
    return {
      prop: prop.id,
      propType: prop?.type,
      start: prop.start,
      len: prop.size,
      edgeType: fromProp?.edges?.id, // do in a bit
      order: ast.order === 'asc' ? Order.asc : Order.desc,
      lang: LangCode.none,
    }
  }

  const prop = typeDef.props.get(field)
  if (!prop) {
    throw new Error(`Cannot find prop in sort ${ast.sort!.prop}`)
  }
  return {
    prop: prop.id,
    propType: prop?.type,
    start: prop.start,
    len: prop.size,
    edgeType: 0, // do in a bit
    order: ast.order === 'asc' ? Order.asc : Order.desc,
    lang: LangCode.none,
  }
}
