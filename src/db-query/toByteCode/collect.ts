import { TypeDef } from '../../schema/defs/index.js'
import { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import { IncludeOp, PropType, pushIncludeHeader } from '../../zigTsExports.js'
import { QueryAst, QueryAstCtx } from '../ast.js'
import { includeProp } from './include.js'

export const collect = (
  ast: QueryAst,
  buf: AutoSizedUint8Array,
  typeDef: TypeDef,
  path: string[],
  ctx: QueryAstCtx = { main: [] },
) => {
  for (const field in ast.props) {
    const propDef = typeDef.props.get(field)
    if (propDef) {
      // LANGUAGE
      // $EDGE
      if (propDef.type === PropType.reference) {
        // REFERENCE
      } else if (propDef.type === PropType.references) {
        // REFERENCES
      } else if (propDef.id === 0) {
        ctx.main.push(propDef)
      } else {
        includeProp(buf, propDef)
      }
    } else {
      if ('props' in ast) {
        collect(ast, buf, typeDef, [...path, field], ctx)
      } else {
        throw new Error(`Prop does not exist ${field}`)
      }
    }
  }
  return ctx
}
