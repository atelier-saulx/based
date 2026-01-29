import { PropDef, TypeDef, isPropDef } from '../../schema/defs/index.js'
import {
  IncludeOp,
  MAIN_PROP,
  PropType,
  pushIncludeHeader,
  pushIncludePartialHeader,
  pushIncludePartialProp,
} from '../../zigTsExports.js'
import { Ctx, Include, IncludeCtx, QueryAst } from './ast.js'
import { readPropDef } from './readSchema.js'
import { reference } from './single.js'

const includeProp = (ctx: Ctx, prop: PropDef, include: Include) => {
  pushIncludeHeader(ctx.query, {
    op: IncludeOp.default,
    prop: prop.id,
    propType: prop.type,
  })
  ctx.readSchema.props[prop.id] = readPropDef(prop, ctx.locales, include)
}

const includeMainProps = (
  ctx: Ctx,
  props: { prop: PropDef; include: Include }[],
  typeDef: TypeDef,
) => {
  props.sort((a, b) =>
    a.prop.start < b.prop.start ? -1 : a.prop.start === b.prop.start ? 0 : 1,
  )
  let i = 0
  for (const { include, prop } of props) {
    i += prop.size
    ctx.readSchema.main.props[prop.start ?? 0] = readPropDef(
      prop,
      ctx.locales,
      include,
    )
    ctx.readSchema.main.len += prop.size
  }
  if (props.length === typeDef.main.length) {
    pushIncludeHeader(ctx.query, {
      op: IncludeOp.default,
      prop: 0,
      propType: PropType.microBuffer,
    })
  } else if (props.length > 0) {
    pushIncludePartialHeader(ctx.query, {
      op: IncludeOp.partial,
      prop: MAIN_PROP,
      propType: PropType.microBuffer,
      amount: props.length,
    })
    for (const { prop, include } of props) {
      pushIncludePartialProp(ctx.query, {
        start: prop.start,
        size: prop.size,
      })
    }
  }
}

export const collect = (
  ast: QueryAst,
  ctx: Ctx,
  typeDef: TypeDef,
  includeCtx: IncludeCtx,
) => {
  const { main, tree } = includeCtx
  // if ast.include.glob === '*' include all from schema
  // same for ast.include.glob === '**'
  for (const field in ast.props) {
    const prop = tree.get(field)
    const astProp = ast.props[field]
    const include = astProp.include
    if (isPropDef(prop)) {
      if (prop.type === PropType.reference) {
        reference(astProp, ctx, prop)
      } else if (include) {
        if (prop.id === 0) {
          main.push({ prop, include })
        } else {
          includeProp(ctx, prop, include)
        }
      }
    } else {
      if (prop) {
        collect(astProp, ctx, typeDef, {
          main,
          tree: prop,
        })
      } else {
        // if EN, if NL
        throw new Error(`Prop does not exist ${field}`)
      }
    }
  }
  return includeCtx
}

export const include = (ast: QueryAst, ctx: Ctx, typeDef: TypeDef): number => {
  const includeStart = ctx.query.length
  const { main } = collect(ast, ctx, typeDef, {
    main: [],
    tree: typeDef.tree,
  })
  includeMainProps(ctx, main, typeDef)
  return ctx.query.length - includeStart
}
