import {
  PropDef,
  PropTree,
  TypeDef,
  isPropDef,
} from '../../schema/defs/index.js'
import { AutoSizedUint8Array } from '../../utils/AutoSizedUint8Array.js'
import {
  IncludeOp,
  MAIN_PROP,
  PropType,
  pushIncludeHeader,
  pushIncludePartialHeader,
  pushIncludePartialProp,
} from '../../zigTsExports.js'
import { Include, QueryAst } from '../ast.js'
import { reference } from './single.js'

type IncludeCtx = {
  tree: PropTree
  main: { prop: PropDef; include: Include }[]
}

// type IncludeOpts

const includeProp = (
  buf: AutoSizedUint8Array,
  prop: PropDef,
  include: Include,
) => {
  // ADD TEXT
  // OPTS
  // META
  pushIncludeHeader(buf, {
    op: IncludeOp.default,
    prop: prop.id,
    propType: prop.type,
  })
}

const includeMainProps = (
  buf: AutoSizedUint8Array,
  props: { prop: PropDef; include: Include }[],
  typeDef: TypeDef,
) => {
  props.sort((a, b) =>
    a.prop.start < b.prop.start ? -1 : a.prop.start === b.prop.start ? 0 : 1,
  )
  if (props.length === typeDef.main.length) {
    pushIncludeHeader(buf, {
      op: IncludeOp.default,
      prop: 0,
      propType: PropType.microBuffer,
    })
  } else if (props.length > 0) {
    pushIncludePartialHeader(buf, {
      op: IncludeOp.partial,
      prop: MAIN_PROP,
      propType: PropType.microBuffer,
      amount: props.length,
    })
    for (const { prop, include } of props) {
      // include
      pushIncludePartialProp(buf, {
        start: prop.start,
        size: prop.size,
      })
    }
  }
}

export const collect = (
  ast: QueryAst,
  buf: AutoSizedUint8Array,
  typeDef: TypeDef,
  ctx: IncludeCtx,
) => {
  // if ast.include.glob === '*' include all from schema
  // same for ast.include.glob === '**'
  for (const field in ast.props) {
    const prop = ctx.tree.get(field)
    const astProp = ast.props[field]
    const include = astProp.include

    if (isPropDef(prop)) {
      console.log(prop.path)

      if (prop.type === PropType.reference) {
        reference(astProp, buf, prop)
      } else if (include) {
        if (prop.id === 0) {
          ctx.main.push({ prop, include })
        } else {
          includeProp(buf, prop, include)
        }
      }
    } else {
      if (prop) {
        collect(astProp, buf, typeDef, {
          main: ctx.main,
          tree: prop,
        })
      } else {
        // if EN, if NL
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
  const ctx = collect(ast, buf, typeDef, {
    main: [],
    tree: typeDef.tree,
  })
  includeMainProps(buf, ctx.main, typeDef)
  return buf.length - includeStart
}
