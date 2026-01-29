import { PropDef, TypeDef } from '../../schema/defs/index.js'
import { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import {
  IncludeOp,
  MAIN_PROP,
  PropType,
  pushIncludeHeader,
  pushIncludePartialHeader,
  pushIncludePartialProp,
} from '../../zigTsExports.js'
import { QueryAst } from '../ast.js'

type IncludeCtx = {
  main: PropDef[]
}

const includeProp = (buf: AutoSizedUint8Array, prop: PropDef) => {
  pushIncludeHeader(buf, {
    op: IncludeOp.default,
    prop: prop.id,
    propType: prop.type,
  })
}

const includeMainProps = (
  buf: AutoSizedUint8Array,
  props: PropDef[],
  typeDef: TypeDef,
) => {
  props.sort((a, b) => (a.start < b.start ? -1 : a.start === b.start ? 0 : 1))
  if (props.length === typeDef.main.length) {
    pushIncludeHeader(buf, {
      op: IncludeOp.default,
      prop: 0,
      propType: PropType.microBuffer,
    })
  } else {
    pushIncludePartialHeader(buf, {
      op: IncludeOp.partial,
      prop: MAIN_PROP,
      propType: PropType.microBuffer,
      amount: props.length,
    })
    for (const { start, size } of props) {
      pushIncludePartialProp(buf, {
        start,
        size,
      })
    }
  }
}

export const collect = (
  ast: QueryAst,
  buf: AutoSizedUint8Array,
  typeDef: TypeDef,
  path: string[],
  ctx: IncludeCtx = { main: [] },
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

export const include = (
  ast: QueryAst,
  buf: AutoSizedUint8Array,
  typeDef: TypeDef,
): number => {
  const includeStart = buf.length
  const ctx = collect(ast, buf, typeDef, [])
  includeMainProps(buf, ctx.main, typeDef)
  const includeSize = buf.length - includeStart
  return includeSize
}
